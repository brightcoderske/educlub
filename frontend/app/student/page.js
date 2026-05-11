"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Medal,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  Trophy
} from "lucide-react";
import { api, assetUrl } from "../../lib/api";
import { currentUser, logout } from "../../lib/auth";
import "./student-dashboard.css";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "badges", label: "Badges", icon: Award },
  { id: "typing", label: "Typing", icon: Gauge },
  { id: "quizzes", label: "Quizzes", icon: Target }
];

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function numberLabel(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${Number(value).toFixed(1)}${suffix}`;
}

function liveTypingStats(passage, typedText, startedAt) {
  const typed = String(typedText || "");
  const expected = String(passage || "");
  const elapsedMinutes = startedAt ? Math.max((Date.now() - startedAt) / 60000, 1 / 60) : 1 / 60;
  let correct = 0;
  for (let index = 0; index < typed.length; index += 1) {
    if (typed[index] === expected[index]) correct += 1;
  }
  return {
    wpm: (correct / 5) / elapsedMinutes,
    accuracy: typed.length ? (correct / typed.length) * 100 : 100
  };
}

function TypingProgress({ passage, typedText }) {
  const expected = String(passage || "");
  const typed = String(typedText || "");
  return (
    <div className="typing-passage" onCopy={(event) => event.preventDefault()}>
      {expected.split("").map((char, index) => {
        const typedChar = typed[index];
        let className = "pending";
        if (typedChar !== undefined) className = typedChar === char ? "correct" : "wrong";
        if (index === typed.length) className = `${className} current`;
        return <span key={`${char}-${index}`} className={className}>{char}</span>;
      })}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  return (
    <article className={`student-stat ${tone || ""}`}>
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value ?? "0"}</strong>
    </article>
  );
}

function EmptyState({ title }) {
  return <div className="student-empty">{title}</div>;
}

function CourseBars({ rows }) {
  if (!rows?.length) return <EmptyState title="No course performance records yet." />;
  const max = Math.max(...rows.map((row) => Number(row.average_score || 0)), 100);
  return (
    <div className="course-bars">
      {rows.map((row) => {
        const score = Number(row.average_score || 0);
        return (
          <div className="course-bar-row" key={row.course_id}>
            <span>{row.course_name}</span>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min((score / max) * 100, 100)}%` }} /></div>
            <strong>{row.average_score == null ? "-" : Number(row.average_score).toFixed(1)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function TrendChart({ rows, valueKey = "average_score", valueLabel = "Score" }) {
  if (!rows?.length) return <EmptyState title="No weekly quiz trend yet." />;
  const width = 520;
  const height = 170;
  const padding = 26;
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (rows.length - 1);
    const y = height - padding - (Number(row[valueKey] || 0) / 100) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="student-trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weekly quiz trend">
        <text x={width / 2} y={height - 4} textAnchor="middle">{valueLabel} by week</text>
        <text x="12" y={height / 2} textAnchor="middle" transform={`rotate(-90 12 ${height / 2})`}>{valueLabel}</text>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
        <polyline points={points} />
        {rows.map((row, index) => {
          const x = rows.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (rows.length - 1);
          const y = height - padding - (Number(row[valueKey] || 0) / 100) * (height - padding * 2);
          return <circle key={row.week_start || index} cx={x} cy={y} r="5" />;
        })}
      </svg>
      <div className="student-trend-labels">
        {rows.map((row, index) => <span key={row.week_start || index}>Week {index + 1}: {Number(row[valueKey] || 0).toFixed(1)}</span>)}
      </div>
    </div>
  );
}

function DataTable({ rows, columns, emptyTitle }) {
  if (!rows?.length) return <EmptyState title={emptyTitle} />;
  const rowKey = (row, index) => {
    return row.id || row.enrolment_id || row.course_id || row.quiz_id || row.assignment_id || row.created_at || `${row.leaderboard_type || "row"}-${row.rank || index}-${index}`;
  };
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveReportCard({ report }) {
  if (!report) return <EmptyState title="No live report data yet." />;
  const logo = report.school?.logo_url ? assetUrl(report.school.logo_url) : "";
  const termLabel = report.term ? `${report.term.year} - ${report.term.name}` : "No active term";
  const summary = report.summary || {};
  return (
    <div className="student-report-card">
      <div className="student-report-header">
        {logo ? <img className="student-report-logo" src={logo} alt={`${report.school?.name || "School"} logo`} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
        <div>
          <p className="eyebrow">{report.school?.name || "Your school"}</p>
          <h2>{report.learner?.full_name || "Learner"} Report Card</h2>
          <p>Grade {report.learner?.grade || "-"}{report.learner?.stream ? ` - ${report.learner.stream}` : ""} - {termLabel}</p>
        </div>
      </div>
      <div className="student-report-summary">
        <StatCard label="Courses" value={summary.courses || 0} icon={BookOpen} tone="blue" />
        <StatCard label="Quiz avg" value={numberLabel(summary.quiz_average)} icon={Target} tone="gold" />
        <StatCard label="Typing WPM" value={numberLabel(summary.typing_average_wpm)} icon={Gauge} tone="coral" />
      </div>
      <section>
        <h3>Courses</h3>
        <DataTable rows={report.courses} emptyTitle="No courses allocated for this term." columns={[
          { key: "course_name", label: "Course" },
          { key: "club", label: "Club", render: (row) => row.club || "-" },
          { key: "status", label: "Status" },
          { key: "term_name", label: "Term" }
        ]} />
      </section>
      <section>
        <h3>Assessments</h3>
        <DataTable rows={report.quiz_results} emptyTitle="No quiz attempts for this term." columns={[
          { key: "quiz_title", label: "Quiz", render: (row) => row.quiz_title || "Untitled quiz" },
          { key: "score", label: "Score", render: (row) => numberLabel(row.score) },
          { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }
        ]} />
      </section>
      <section>
        <h3>Leaderboard</h3>
        <DataTable rows={report.leaderboards} emptyTitle="No leaderboard placement yet." columns={[
          { key: "leaderboard_type", label: "Type" },
          { key: "rank", label: "Rank" },
          { key: "score", label: "Score", render: (row) => numberLabel(row.score) }
        ]} />
      </section>
    </div>
  );
}

function WebCourseWorkspace({ course, selectedLesson, lessonDraft, setLessonDraft, onSelectLesson, onSaveLesson, onClose }) {
  const quiz = Array.isArray(selectedLesson?.quiz) ? selectedLesson.quiz : [];
  const practiceCode = lessonDraft.practice_code ?? selectedLesson?.practice_code ?? selectedLesson?.starter_code ?? selectedLesson?.example ?? "";
  return (
    <div className="quiz-take-backdrop">
      <section className="course-workspace" role="dialog" aria-modal="true" aria-label={course.name}>
        <div className="quiz-take-header">
          <div><p className="eyebrow">Web Development</p><h2>{course.name}</h2><p>{course.objectives}</p></div>
          <button type="button" className="student-secondary" onClick={onClose}>Close</button>
        </div>
        <div className="course-workspace-grid">
          <aside className="module-list">
            {course.modules.map((module) => (
              <section key={module.id}>
                <h3>{module.sort_order}. {module.name}</h3>
                <p>{module.is_locked ? "Locked until your teacher opens it." : module.badge_name}</p>
                {module.lessons.map((lesson) => (
                  <button key={lesson.id} type="button" disabled={module.is_locked} className={selectedLesson?.id === lesson.id ? "active" : ""} onClick={() => onSelectLesson(lesson)}>{lesson.name}</button>
                ))}
              </section>
            ))}
          </aside>
          {selectedLesson ? (
            <div className="lesson-sections">
              <section><h3>Learn</h3><p>{selectedLesson.learning_notes || selectedLesson.content}</p></section>
              <section>
                <h3>Practice</h3><p>{selectedLesson.practice_prompt}</p>
                <div className="code-playground">
                  <textarea value={practiceCode} onChange={(e) => setLessonDraft((draft) => ({ ...draft, practice_code: e.target.value }))} />
                  <iframe title="Live preview" srcDoc={practiceCode} sandbox="allow-scripts" />
                </div>
              </section>
              <section><h3>Home Task</h3><p>{selectedLesson.homework_prompt}</p><textarea value={lessonDraft.homework_code ?? selectedLesson.homework_code ?? ""} onChange={(e) => setLessonDraft((draft) => ({ ...draft, homework_code: e.target.value }))} /></section>
              <section><h3>Creativity Base</h3><p>{selectedLesson.creativity_prompt}</p><textarea value={lessonDraft.creativity_code ?? selectedLesson.creativity_code ?? ""} onChange={(e) => setLessonDraft((draft) => ({ ...draft, creativity_code: e.target.value }))} /></section>
              <section>
                <h3>Quiz</h3>
                {quiz.map((question, index) => (
                  <fieldset key={`${question.question}-${index}`} className="mini-quiz-question">
                    <legend>{index + 1}. {question.question}</legend>
                    {(question.options || []).map((option) => <label key={option}><input type="radio" name={`lesson-${selectedLesson.id}-${index}`} checked={(lessonDraft.quiz_answers || {})[index] === option} onChange={() => setLessonDraft((draft) => ({ ...draft, quiz_answers: { ...(draft.quiz_answers || {}), [index]: option } }))} />{option}</label>)}
                  </fieldset>
                ))}
              </section>
              <div className="lesson-action-row">
                <button type="button" onClick={() => onSaveLesson(false)}>Autosave now</button>
                <button type="button" onClick={() => onSaveLesson(true)}>Submit lesson quiz</button>
                {selectedLesson.score !== null && selectedLesson.score !== undefined ? <strong>{Number(selectedLesson.score).toFixed(1)}%</strong> : null}
              </div>
            </div>
          ) : <EmptyState title="Choose an open lesson to begin." />}
        </div>
      </section>
    </div>
  );
}

export default function StudentPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [activeTyping, setActiveTyping] = useState(null);
  const [activeCourse, setActiveCourse] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [lessonDraft, setLessonDraft] = useState({});
  const [answers, setAnswers] = useState({});
  const [typedText, setTypedText] = useState("");
  const [typingStartedAt, setTypingStartedAt] = useState(null);
  const [typingRemaining, setTypingRemaining] = useState(0);
  const [quizResult, setQuizResult] = useState(null);
  const [typingResult, setTypingResult] = useState(null);
  const [typingSubmitting, setTypingSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeTermLabel = useMemo(() => {
    const term = dashboard?.active_term;
    return term ? `${term.year} - ${term.name}` : "No active term";
  }, [dashboard]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDashboard(await api.get("/student/dashboard"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sessionUser = currentUser();
    if (!sessionUser || sessionUser.role !== "student") {
      window.location.href = "/login";
      return;
    }
    setUser(sessionUser);
    loadDashboard();
  }, [loadDashboard]);

  const summary = dashboard?.summary || {};

  async function openQuiz(quizId) {
    setError("");
    setQuizResult(null);
    setAnswers({});
    try {
      setActiveQuiz(await api.get(`/student/quizzes/${quizId}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function openTypingTest(testId) {
    setError("");
    setTypingResult(null);
    setTypingSubmitting(false);
    setTypedText("");
    setTypingStartedAt(null);
    try {
      const test = await api.get(`/student/typing-tests/${testId}`);
      setActiveTyping(test);
      setTypingRemaining(Number(test.duration_seconds || 300));
    } catch (err) {
      setError(err.message);
    }
  }

  async function openCourse(course) {
    setError("");
    if (course.is_coming_soon) {
      setError("Program under development coming soon.");
      return;
    }
    try {
      const detail = await api.get(`/student/courses/${course.course_id}`);
      setActiveCourse(detail);
      const firstLesson = detail.modules.find((module) => !module.is_locked)?.lessons?.[0] || null;
      setSelectedLesson(firstLesson);
      setLessonDraft({});
    } catch (err) {
      setError(err.message);
    }
  }

  function selectLesson(lesson) {
    setSelectedLesson(lesson);
    setLessonDraft({});
  }

  async function saveLesson(submitQuiz = false) {
    if (!selectedLesson || !activeCourse) return;
    const saved = await api.patch(`/student/lessons/${selectedLesson.id}/progress`, {
      ...lessonDraft,
      submit_quiz: submitQuiz
    });
    const detail = await api.get(`/student/courses/${activeCourse.id}`);
    setActiveCourse(detail);
    setSelectedLesson(detail.modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === selectedLesson.id) || selectedLesson);
    setLessonDraft({
      practice_code: saved.practice_code,
      homework_code: saved.homework_code,
      creativity_code: saved.creativity_code,
      quiz_answers: saved.quiz_answers || {}
    });
    await loadDashboard();
  }

  async function submitQuiz(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await api.post(`/student/quizzes/${activeQuiz.quiz_id}/attempts`, { answers });
      setQuizResult(result);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  const finishTypingTest = useCallback(async (finalText = typedText) => {
    if (!activeTyping || typingResult || typingSubmitting) return;
    setError("");
    setTypingSubmitting(true);
    try {
      const duration = Number(activeTyping.duration_seconds || 300);
      const elapsed = typingStartedAt ? Math.max(Math.round((Date.now() - typingStartedAt) / 1000), 1) : duration;
      const passageLength = String(activeTyping.passage || "").length;
      const result = await api.post(`/student/typing-tests/${activeTyping.typing_test_id}/attempts`, {
        typed_text: String(finalText || "").slice(0, passageLength),
        time_taken_seconds: Math.min(elapsed, duration)
      });
      setTypingResult(result);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
      setTypingSubmitting(false);
    }
  }, [activeTyping, typedText, typingStartedAt, typingResult, typingSubmitting, loadDashboard]);

  async function submitTyping(event) {
    event.preventDefault();
    await finishTypingTest();
  }

  function updateTypedText(nextValue) {
    if (!activeTyping || typingResult || typingSubmitting || typingRemaining <= 0) return;
    const passage = String(activeTyping.passage || "");
    const next = String(nextValue || "");
    if (typedText.length >= passage.length) return;
    if (next.length > passage.length) return;
    if (next === typedText) return;

    if (next.startsWith(typedText) && next.length === typedText.length + 1) {
      if (!typingStartedAt) setTypingStartedAt(Date.now());
      setTypedText(next);
      return;
    }

    if (typedText.startsWith(next) && typedText.length === next.length + 1) {
      if (typedText.endsWith(" ")) return;
      const lockedUntil = typedText.lastIndexOf(" ") + 1;
      if (next.length < lockedUntil) return;
      setTypedText(next);
    }
  }

  useEffect(() => {
    if (!activeTyping || !typingStartedAt || typingResult) return undefined;
    const timer = window.setInterval(() => {
      const elapsed = Math.max(Math.floor((Date.now() - typingStartedAt) / 1000), 0);
      const remaining = Math.max(Number(activeTyping.duration_seconds || 300) - elapsed, 0);
      setTypingRemaining(remaining);
      if (remaining <= 0) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [activeTyping, typingStartedAt, typingResult]);

  useEffect(() => {
    if (!activeTyping || typingResult || typingSubmitting) return;
    const passageLength = String(activeTyping.passage || "").length;
    if (passageLength > 0 && typedText.length >= passageLength) {
      finishTypingTest(typedText);
    }
  }, [activeTyping, typedText, typingResult, typingSubmitting, finishTypingTest]);

  useEffect(() => {
    if (activeTyping && typingStartedAt && !typingResult && !typingSubmitting && typingRemaining <= 0) {
      finishTypingTest(typedText);
    }
  }, [activeTyping, typingStartedAt, typingRemaining, typingResult, typingSubmitting, typedText, finishTypingTest]);

  return (
    <main className={`student-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="student-sidebar">
        <div className="student-brand">
          <Trophy size={28} />
          <div>
            <strong>EduClub</strong>
            <span>Learner</span>
          </div>
        </div>
        <button type="button" className="student-sidebar-toggle" onClick={() => setSidebarOpen((open) => !open)} title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}>
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          <span>{sidebarOpen ? "Hide" : "Show"}</span>
        </button>
        <nav>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}><Icon size={18} /><span>{tab.label}</span></button>;
          })}
        </nav>
        <button className="student-logout" onClick={logout}><LogOut size={18} /><span>Sign out</span></button>
      </aside>

      <section className="student-main">
        <header className="student-hero">
          <div className="student-hero-title">
            {dashboard?.learner?.school_logo_url ? <img className="student-school-logo" src={assetUrl(dashboard.learner.school_logo_url)} alt={`${dashboard.learner.school_name} logo`} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
            <div>
              <p className="eyebrow">{dashboard?.learner?.school_name || "Your school"} - {activeTermLabel}</p>
              <h1>Hi, {dashboard?.learner?.full_name || user?.full_name || "learner"}</h1>
              <p>Track your courses, typing growth, quizzes, badges, and reports from one bright learning space.</p>
            </div>
          </div>
          <div className="student-level-card">
            <Medal size={28} />
            <span>Grade</span>
            <strong>{dashboard?.learner?.grade || "-"}</strong>
            <small>{dashboard?.learner?.stream || "No stream"}</small>
          </div>
        </header>

        {error ? <div className="student-alert">{error}</div> : null}
        {loading ? <div className="student-loading">Loading your learning workspace...</div> : null}

        {!loading && dashboard && activeTab === "overview" && (
          <div className="student-section">
            <div className="student-stat-grid">
              <StatCard label="Courses" value={summary.enrolled_courses} icon={BookOpen} tone="blue" />
              <StatCard label="Reports" value={summary.reports} icon={FileText} tone="green" />
              <StatCard label="Badges" value={summary.badges} icon={Award} tone="gold" />
              <StatCard label="Typing WPM" value={numberLabel(summary.average_typing_wpm)} icon={Gauge} tone="coral" />
            </div>
            <section className="student-panel">
              <h2>Course Performance</h2>
              <CourseBars rows={dashboard.course_performance} />
            </section>
            <section className="student-panel">
              <h2>Recent Lesson Progress</h2>
              <DataTable rows={dashboard.lesson_progress.slice(0, 8)} emptyTitle="No lesson progress yet." columns={[
                { key: "course_name", label: "Course" },
                { key: "lesson_name", label: "Lesson" },
                { key: "score", label: "Score", render: (row) => row.score ?? "-" },
                { key: "updated_at", label: "Updated", render: (row) => formatDate(row.updated_at) }
              ]} />
            </section>
            <section className="student-panel">
              <h2>Weekly Quiz Trend</h2>
              <TrendChart rows={dashboard.weekly_quiz_trend} valueKey="best_score" valueLabel="Best quiz score" />
            </section>
          </div>
        )}

        {!loading && dashboard && activeTab === "courses" && (
          <section className="student-panel">
            <h2>My Courses</h2>
            <DataTable rows={dashboard.courses} emptyTitle="No enrolled courses for this term." columns={[
              { key: "course_name", label: "Course", render: (row) => <button type="button" className="link-button" onClick={() => openCourse(row)}>{row.course_name}</button> },
              { key: "club", label: "Club", render: (row) => row.club || "-" },
              { key: "status", label: "Status" },
              { key: "term_name", label: "Term" }
            ]} />
          </section>
        )}

        {!loading && dashboard && activeTab === "reports" && (
          <div className="student-section">
            <section className="student-panel">
              <h2>Live Report Card</h2>
              <LiveReportCard report={dashboard.report_card} />
            </section>
            <section className="student-panel">
              <h2>Published Reports</h2>
              <DataTable rows={dashboard.reports} emptyTitle="No published report cards yet." columns={[
                { key: "term_name", label: "Term" },
                { key: "year", label: "Year" },
                { key: "teacher_remarks", label: "Remarks", render: (row) => row.teacher_remarks || "-" },
                { key: "published_at", label: "Published", render: (row) => row.published_at ? formatDate(row.published_at) : "-" }
              ]} />
            </section>
          </div>
        )}

        {!loading && dashboard && activeTab === "badges" && (
          <section className="student-panel">
            <h2>Badges & Leaderboards</h2>
            <DataTable rows={dashboard.badges} emptyTitle="No badges or leaderboard entries yet." columns={[
              { key: "leaderboard_type", label: "Type" },
              { key: "rank", label: "Rank" },
              { key: "score", label: "Score" },
              { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }
            ]} />
          </section>
        )}

        {!loading && dashboard && activeTab === "typing" && (
          <div className="student-section">
            <section className="student-panel">
              <h2>Assigned Typing Tests</h2>
              <DataTable rows={dashboard.assigned_typing_tests} emptyTitle="No typing tests assigned for this week." columns={[
                { key: "title", label: "Test" },
                { key: "duration_seconds", label: "Seconds" },
                { key: "best_wpm", label: "Best WPM", render: (row) => row.best_wpm == null ? "-" : Number(row.best_wpm).toFixed(1) },
                { key: "attempts", label: "Attempts", render: (row) => `${row.attempts_used || 0}/${row.max_attempts || 3}` },
                { key: "action", label: "Action", render: (row) => Number(row.attempts_used || 0) < Number(row.max_attempts || 3) ? <button type="button" onClick={() => openTypingTest(row.typing_test_id)}>Start test</button> : "Attempts used" }
              ]} />
            </section>
            <section className="student-panel">
              <h2>Weekly Typing Trend</h2>
              <TrendChart rows={dashboard.weekly_typing_trend} valueKey="best_wpm" valueLabel="Best WPM" />
            </section>
            <section className="student-panel">
              <h2>Typing Results</h2>
              <DataTable rows={dashboard.typing_results} emptyTitle="No typing results for this term." columns={[
                { key: "test_title", label: "Test", render: (row) => row.test_title || "Typing test" },
                { key: "wpm", label: "WPM" },
                { key: "accuracy", label: "Accuracy", render: (row) => numberLabel(row.accuracy, "%") },
                { key: "time_taken_seconds", label: "Time" },
                { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }
              ]} />
            </section>
          </div>
        )}

        {!loading && dashboard && activeTab === "quizzes" && (
          <div className="student-section">
            <section className="student-panel">
              <h2>Assigned Quizzes</h2>
              <DataTable rows={dashboard.assigned_quizzes} emptyTitle="No quizzes assigned for this term." columns={[
                { key: "title", label: "Quiz" },
                { key: "attempts_used", label: "Attempts", render: (row) => `${row.attempts_used}/${row.max_attempts}` },
                { key: "best_score", label: "Best", render: (row) => row.best_score == null ? "-" : Number(row.best_score).toFixed(1) },
                { key: "action", label: "Action", render: (row) => row.can_attempt ? <button type="button" onClick={() => openQuiz(row.quiz_id)}>Take quiz</button> : "Attempts used" }
              ]} />
            </section>
            <section className="student-panel">
              <h2>Quiz Results</h2>
              <DataTable rows={dashboard.quiz_results} emptyTitle="No quiz attempts for this term." columns={[
                { key: "quiz_title", label: "Quiz", render: (row) => row.quiz_title || "Untitled quiz" },
                { key: "score", label: "Score" },
                { key: "time_taken_seconds", label: "Time" },
                { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }
              ]} />
            </section>
          </div>
        )}
      </section>
      {activeQuiz ? (
        <div className="quiz-take-backdrop">
          <section className="quiz-take-panel" role="dialog" aria-modal="true" aria-label={activeQuiz.title}>
            <div className="quiz-take-header">
              <div>
                <p className="eyebrow">Quiz</p>
                <h2>{activeQuiz.title}</h2>
                <p>{activeQuiz.description || "Answer each question and submit when ready."}</p>
              </div>
              <button type="button" className="student-secondary" onClick={() => setActiveQuiz(null)}>Close</button>
            </div>
            {quizResult ? (
              <div className="quiz-result-card">
                <CheckCircle2 size={28} />
                <strong>{Number(quizResult.score).toFixed(1)} / 100</strong>
                <span>{quizResult.expectation}</span>
                <button type="button" onClick={() => setActiveQuiz(null)}>Done</button>
              </div>
            ) : (
              <form className="quiz-take-form" onSubmit={submitQuiz}>
                {activeQuiz.questions.map((question, index) => (
                  <fieldset key={question.id}>
                    <legend>{index + 1}. {question.question}</legend>
                    {[
                      ["A", question.option_a],
                      ["B", question.option_b],
                      ["C", question.option_c],
                      ["D", question.option_d]
                    ].map(([option, label]) => (
                      <label className="quiz-option" key={option}>
                        <input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers({ ...answers, [question.id]: option })} required />
                        <span>{option}. {label}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
                <button type="submit"><CheckCircle2 size={16} />Submit quiz</button>
              </form>
            )}
          </section>
        </div>
      ) : null}
      {activeTyping ? (
        <div className="quiz-take-backdrop">
          <section className="quiz-take-panel" role="dialog" aria-modal="true" aria-label={activeTyping.title}>
            <div className="quiz-take-header">
              <div>
                <p className="eyebrow">Typing Test</p>
                <h2>{activeTyping.title}</h2>
                <p>Time remaining: {typingRemaining}s</p>
              </div>
              <button type="button" className="student-secondary" onClick={() => setActiveTyping(null)}>Close</button>
            </div>
            {typingResult ? (
              <div className="quiz-result-card">
                <CheckCircle2 size={28} />
                <strong>{Number(typingResult.wpm).toFixed(1)} WPM</strong>
                <span>{Number(typingResult.accuracy).toFixed(1)}% accuracy</span>
                <button type="button" onClick={() => setActiveTyping(null)}>Done</button>
              </div>
            ) : (
              <form className="quiz-take-form" onSubmit={submitTyping}>
                <TypingProgress passage={activeTyping.passage} typedText={typedText} />
                {(() => {
                  const stats = liveTypingStats(activeTyping.passage, typedText, typingStartedAt);
                  return (
                    <div className="student-stat-grid">
                      <StatCard label="Speed" value={numberLabel(stats.wpm)} icon={Gauge} tone="blue" />
                      <StatCard label="Accuracy" value={numberLabel(stats.accuracy, "%")} icon={Target} tone="green" />
                      <StatCard label="Remaining" value={`${typingRemaining}s`} icon={BarChart3} tone="gold" />
                    </div>
                  );
                })()}
                <textarea
                  className="typing-input"
                  value={typedText}
                  onKeyDown={(event) => {
                    if (!typingStartedAt) setTypingStartedAt(Date.now());
                    if (event.key === "Backspace" && typedText.endsWith(" ")) event.preventDefault();
                  }}
                  onPaste={(event) => event.preventDefault()}
                  onDrop={(event) => event.preventDefault()}
                  onBeforeInput={(event) => {
                    if (event.nativeEvent?.inputType?.toLowerCase().includes("paste")) event.preventDefault();
                  }}
                  onChange={(event) => updateTypedText(event.target.value)}
                  disabled={typingRemaining <= 0 || typingSubmitting || typedText.length >= String(activeTyping.passage || "").length}
                  rows={7}
                  autoFocus
                  required
                />
                <button type="submit" disabled className="typing-auto-submit"><CheckCircle2 size={16} />{typingSubmitting ? "Submitting..." : "Auto-submits at finish"}</button>
              </form>
            )}
          </section>
        </div>
      ) : null}
      {activeCourse ? (
        <WebCourseWorkspace
          course={activeCourse}
          selectedLesson={selectedLesson}
          lessonDraft={lessonDraft}
          setLessonDraft={setLessonDraft}
          onSelectLesson={selectLesson}
          onSaveLesson={saveLesson}
          onClose={() => setActiveCourse(null)}
        />
      ) : null}
    </main>
  );
}
