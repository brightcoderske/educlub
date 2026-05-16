"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Sparkles,
  Star,
  Target,
  Trophy,
  Confetti
} from "lucide-react";
import { api, assetUrl } from "../../lib/api";
import { currentUser, logout } from "../../lib/auth";
import StudentCourseView from "../../modules/courseBuilder/StudentCourseView";
import "./student-dashboard.css";

const SIDEBAR_HIDE_DELAY_MS = 420;

// Sound effects for kid-friendly interactions
const playSuccessSound = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
  oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
  oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
};

const playCelebrationSound = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  
  notes.forEach((freq, i) => {
    setTimeout(() => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }, i * 100);
  });
};

function Celebration({ show, onClose }) {
  if (!show) return null;
  
  useEffect(() => {
    playCelebrationSound();
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [show, onClose]);
  
  return (
    <div className="celebration-overlay">
      <div className="celebration-content">
        <div className="celebration-icon">
          <Trophy size={64} />
        </div>
        <h2>🎉 Great Job! 🎉</h2>
        <p>You completed this module!</p>
        <div className="celebration-stars">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={32} className="star-animation" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        <div className="celebration-confetti">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="confetti-piece" style={{ 
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "badges", label: "Badges & Leaderboards", icon: Award },
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
  const padding = 30;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;

  const maxValue = Math.max(...rows.map(r => Number(r[valueKey] || 0)), 100);
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? width / 2 : padding + (index * chartWidth) / (rows.length - 1);
    const y = height - padding - (Number(row[valueKey] || 0) / maxValue) * chartHeight;
    return { x, y, value: Number(row[valueKey] || 0) };
  });

  const pointsStr = points.map(p => `${p.x},${p.y}`).join(" ");
  const gradientId = `trend-gradient-${valueKey}`;

  return (
    <div className="student-trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weekly quiz trend">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(percent => {
          const y = height - padding - (percent / 100) * chartHeight;
          return (
            <line
              key={`grid-${percent}`}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map(percent => {
          const y = height - padding - (percent / 100) * chartHeight;
          return (
            <text
              key={`ylabel-${percent}`}
              x={padding - 8}
              y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill="#94a3b8"
              fontWeight="500"
            >
              {percent}
            </text>
          );
        })}

        {/* X-axis labels */}
        {points.map((p, index) => (
          <text
            key={`xlabel-${index}`}
            x={p.x}
            y={height - padding + 15}
            textAnchor="middle"
            fontSize="10"
            fill="#94a3b8"
            fontWeight="500"
          >
            W{index + 1}
          </text>
        ))}

        {/* Axis lines */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="2" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="2" />

        {/* Area fill */}
        <polygon
          points={`${padding},${height - padding} ${pointsStr} ${points[points.length - 1].x},${height - padding}`}
          fill={`url(#${gradientId})`}
        />

        {/* Line */}
        <polyline
          points={pointsStr}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points with labels */}
        {points.map((p, index) => (
          <g key={`point-${index}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r="6"
              fill="#fff"
              stroke="#3b82f6"
              strokeWidth="3"
              style={{ cursor: "pointer" }}
            />
            <text
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              fontSize="11"
              fill="#1e40af"
              fontWeight="700"
            >
              {p.value.toFixed(1)}
            </text>
          </g>
        ))}
      </svg>
      <div className="student-trend-labels">
        {points.map((p, index) => (
          <span key={index}>Week {index + 1}: {p.value.toFixed(1)}</span>
        ))}
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
            <tr key={`${rowKey(row, index)}-${index}`}>
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
        {report.courses?.length ? (
          <div className="student-section" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {report.courses.map((course, index) => (
              <div key={`course-${index}`} className="student-course-card" style={{ cursor: "default" }}>
                <h3>{course.course_name || "Untitled Course"}</h3>
                <div className="course-meta">
                  <span>{course.club || "No club"}</span>
                  <span>{course.status || "Active"}</span>
                  <span>{course.term_name || "Current term"}</span>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No courses allocated for this term." />}
      </section>
      <section>
        <h3>Assessments</h3>
        {report.quiz_results?.length ? (
          <div className="student-section" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {report.quiz_results.map((quiz, index) => (
              <div key={`quiz-${index}`} className="student-quiz-card" style={{ cursor: "default" }}>
                <h3>{quiz.quiz_title || "Untitled Quiz"}</h3>
                <div className="quiz-meta">
                  <span>{formatDate(quiz.created_at)}</span>
                </div>
                <div className="quiz-score">{numberLabel(quiz.score)}%</div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No quiz attempts for this term." />}
      </section>
      <section>
        <h3>Leaderboard</h3>
        {report.leaderboards?.length ? (
          <div className="student-leaderboard-card">
            <h3>Leaderboard Rankings</h3>
            {report.leaderboards.map((entry, index) => (
              <div key={`leaderboard-${index}`} className={`leaderboard-row ${index < 3 ? "highlight" : ""}`}>
                <div className="leaderboard-rank">#{entry.rank || "-"}</div>
                <div className="leaderboard-name">{entry.leaderboard_type || "Category"}</div>
                <div className="leaderboard-score">{numberLabel(entry.score)}</div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="No leaderboard placement yet." />}
      </section>
    </div>
  );
}

function QuizCard({ quiz, onTake }) {
  return (
    <div className="student-quiz-card">
      <h3>{quiz.title || "Untitled Quiz"}</h3>
      <div className="quiz-meta">
        <span>{quiz.attempts_used || 0}/{quiz.max_attempts || 3} attempts</span>
        {quiz.best_score != null && <span>Best: {Number(quiz.best_score).toFixed(1)}%</span>}
      </div>
      {quiz.best_score != null && <div className="quiz-score">{Number(quiz.best_score).toFixed(1)}%</div>}
      {quiz.can_attempt && <button type="button" onClick={() => onTake(quiz.quiz_id)}>Take Quiz</button>}
    </div>
  );
}

function TypingCard({ test, onStart }) {
  return (
    <div className="student-typing-card">
      <h3>{test.title || "Typing Test"}</h3>
      <div className="typing-stats">
        <div className="typing-stat">
          <strong>{test.best_wpm == null ? "-" : Number(test.best_wpm).toFixed(1)}</strong>
          <span>Best WPM</span>
        </div>
        <div className="typing-stat">
          <strong>{test.attempts_used || 0}/{test.max_attempts || 3}</strong>
          <span>Attempts</span>
        </div>
      </div>
      {Number(test.attempts_used || 0) < Number(test.max_attempts || 3) && <button type="button" onClick={() => onStart(test.typing_test_id)}>Start Test</button>}
    </div>
  );
}

function BadgeCard({ badge }) {
  return (
    <div className="student-badge-card">
      <div className="badge-icon"><Award size={32} /></div>
      <h3>{badge.leaderboard_type || "Badge"}</h3>
      <div className="badge-date">{formatDate(badge.created_at)}</div>
    </div>
  );
}

function CourseCard({ course }) {
  const router = useRouter();
  // Try multiple possible field names for progress
  const progress = course.progress || course.completion_percent || course.percent_complete || course.lessons_completed_percent || 0;
  const hasProgress = progress > 0 || progress !== 0;
  
  return (
    <div className="student-course-card" onClick={() => router.push(`/student/course/${course.course_id}`)}>
      {course.cover_image_url ? (
        <img className="student-course-cover" src={assetUrl(course.cover_image_url)} alt={`${course.course_name || "Course"} cover`} />
      ) : null}
      <h3>{course.course_name || "Untitled Course"}</h3>
      <div className="course-meta">
        <span>{course.club || "No club"}</span>
        <span>{course.status || "Active"}</span>
        <span>{course.term_name || "Current term"}</span>
      </div>
      {hasProgress && (
        <div className="course-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="progress-text">{progress.toFixed(0)}% complete</div>
        </div>
      )}
    </div>
  );
}

function courseTrackLabel(technology) {
  const map = {
    python: "Python",
    web: "Web (HTML/CSS/JS)",
    android: "Android",
    arduino: "Arduino",
    scratch: "Scratch",
    robotics: "Robotics",
    computer_basics: "Computer basics",
    other: "Mixed / other"
  };
  return map[String(technology || "").toLowerCase()] || "Your course";
}

function patchActivityProgress(draft, stepId, partial) {
  return {
    ...draft,
    activity_progress: {
      ...(draft.activity_progress || {}),
      [stepId]: { ...(draft.activity_progress?.[stepId] || {}), ...partial }
    }
  };
}

function initialLessonDraft(lesson) {
  if (!lesson) return {};
  let quizAnswers = {};
  const raw = lesson.quiz_answers;
  if (raw && typeof raw === "object") quizAnswers = raw;
  else if (typeof raw === "string") {
    try {
      quizAnswers = JSON.parse(raw);
    } catch {
      quizAnswers = {};
    }
  }
  const ap = lesson.activity_progress;
  return {
    practice_code: lesson.practice_code || "",
    homework_code: lesson.homework_code || "",
    creativity_code: lesson.creativity_code || "",
    quiz_answers: quizAnswers,
    activity_progress: ap && typeof ap === "object" ? { ...ap } : {}
  };
}

function average(rows, key) {
  const values = (rows || []).map((row) => Number(row[key])).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sameId(left, right) {
  return String(left || "") === String(right || "");
}

export default function StudentPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarOpenRef = useRef(false);
  const hideSidebarTimerRef = useRef(null);
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
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [typingSubmitting, setTypingSubmitting] = useState(false);
  const [studentNotice, setStudentNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeTermLabel = useMemo(() => {
    const term = dashboard?.active_term;
    return term ? `${term.year} - ${term.name}` : "No active term";
  }, [dashboard]);

  const weeklyWork = useMemo(() => {
    if (!dashboard) return [];
    return [
      ...(dashboard.assigned_quizzes || []).filter((quiz) => quiz.can_attempt).slice(0, 4).map((quiz) => ({
        id: `quiz-${quiz.quiz_id}`,
        type: "Quiz",
        title: quiz.title || "Assigned quiz",
        detail: `${quiz.attempts_used || 0}/${quiz.max_attempts || 1} attempts used`,
        action: () => openQuiz(quiz.quiz_id)
      })),
      ...(dashboard.assigned_typing_tests || []).slice(0, 4).map((test) => ({
        id: `typing-${test.typing_test_id}`,
        type: "Typing",
        title: test.title || "Typing test",
        detail: `${test.attempts_used || 0}/${test.max_attempts || 3} attempts used`,
        action: () => openTypingTest(test.typing_test_id)
      })),
      ...(dashboard.courses || []).slice(0, 4).map((course) => ({
        id: `course-${course.course_id}`,
        type: "Module",
        title: course.course_name || "Course module",
        detail: course.term_name || "Assigned course",
        action: () => router.push(`/student/course/${course.course_id}`)
      }))
    ].slice(0, 8);
  }, [dashboard, router]);

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

  useEffect(() => {
    sidebarOpenRef.current = sidebarOpen;
  }, [sidebarOpen]);

  const clearHideSidebarTimer = useCallback(() => {
    if (hideSidebarTimerRef.current) {
      clearTimeout(hideSidebarTimerRef.current);
      hideSidebarTimerRef.current = null;
    }
  }, []);

  const scheduleHideSidebar = useCallback(() => {
    clearHideSidebarTimer();
    if (!sidebarOpenRef.current) return;
    hideSidebarTimerRef.current = setTimeout(() => {
      hideSidebarTimerRef.current = null;
      if (sidebarOpenRef.current) {
        setSidebarOpen(false);
      }
    }, SIDEBAR_HIDE_DELAY_MS);
  }, [clearHideSidebarTimer]);

  function onSidebarPointerEnter() {
    clearHideSidebarTimer();
    setSidebarOpen(true);
  }

  function onSidebarPointerLeave() {
    scheduleHideSidebar();
  }

  function toggleSidebar() {
    clearHideSidebarTimer();
    setSidebarOpen((open) => !open);
  }

  useEffect(() => {
    return () => clearHideSidebarTimer();
  }, [clearHideSidebarTimer]);

  const summary = dashboard?.summary || {};

  const updateDashboardAfterLesson = useCallback((lesson, saved, courseDetail) => {
    setDashboard((current) => {
      if (!current) return current;
      const courseName = courseDetail?.title || courseDetail?.name || activeCourse?.title || activeCourse?.name || "Course";
      const nextLesson = {
        id: saved.id || lesson.id,
        lesson_id: lesson.id,
        lesson_name: lesson.title || lesson.lesson_name || "Untitled Lesson",
        course_id: courseDetail?.id || activeCourse?.id || lesson.course_id,
        course_name: courseName,
        score: saved.score ?? lesson.score ?? null,
        updated_at: saved.updated_at || new Date().toISOString()
      };
      const lessonProgress = [
        nextLesson,
        ...(current.lesson_progress || []).filter((row) => !sameId(row.lesson_id || row.id, lesson.id))
      ].slice(0, 12);
      return { ...current, lesson_progress: lessonProgress };
    });
  }, [activeCourse]);

  const updateDashboardAfterQuiz = useCallback((result) => {
    setDashboard((current) => {
      if (!current || !activeQuiz) return current;
      const score = Number(result.score || 0);
      const quizResults = [
        {
          id: result.id,
          quiz_id: result.quiz_id || activeQuiz.quiz_id,
          quiz_title: activeQuiz.title || "Untitled Quiz",
          score,
          time_taken_seconds: result.time_taken_seconds ?? null,
          created_at: result.created_at || new Date().toISOString(),
          term_name: current.active_term?.name,
          year: current.active_term?.year
        },
        ...(current.quiz_results || [])
      ];
      const assignedQuizzes = (current.assigned_quizzes || []).map((quiz) => {
        if (!sameId(quiz.quiz_id, activeQuiz.quiz_id)) return quiz;
        const attemptsUsed = Number(quiz.attempts_used || 0) + 1;
        const maxAttempts = Number(quiz.max_attempts || 3);
        return {
          ...quiz,
          attempts_used: attemptsUsed,
          best_score: Math.max(Number(quiz.best_score || 0), score),
          can_attempt: attemptsUsed < maxAttempts,
          expectation: result.expectation || quiz.expectation
        };
      });
      return {
        ...current,
        assigned_quizzes: assignedQuizzes,
        quiz_results: quizResults,
        summary: {
          ...(current.summary || {}),
          average_quiz_score: average(quizResults, "score")
        }
      };
    });
  }, [activeQuiz]);

  const updateDashboardAfterTyping = useCallback((result) => {
    setDashboard((current) => {
      if (!current || !activeTyping) return current;
      const wpm = Number(result.wpm || 0);
      const accuracy = Number(result.accuracy || 0);
      const typingResults = [
        {
          id: result.id,
          typing_test_id: result.typing_test_id || activeTyping.typing_test_id,
          test_title: activeTyping.title || "Typing test",
          wpm,
          accuracy,
          time_taken_seconds: result.time_taken_seconds,
          created_at: result.created_at || new Date().toISOString(),
          term_name: current.active_term?.name,
          year: current.active_term?.year
        },
        ...(current.typing_results || [])
      ];
      const assignedTypingTests = (current.assigned_typing_tests || []).map((test) => {
        if (!sameId(test.typing_test_id, activeTyping.typing_test_id)) return test;
        return {
          ...test,
          attempts_used: Number(test.attempts_used || 0) + 1,
          best_wpm: Math.max(Number(test.best_wpm || 0), wpm)
        };
      });
      return {
        ...current,
        assigned_typing_tests: assignedTypingTests,
        typing_results: typingResults,
        summary: {
          ...(current.summary || {}),
          average_typing_wpm: average(typingResults, "wpm"),
          average_typing_accuracy: average(typingResults, "accuracy")
        }
      };
    });
  }, [activeTyping]);

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
      setLessonDraft(initialLessonDraft(firstLesson));
    } catch (err) {
      setError(err.message);
    }
  }

  function selectLesson(lesson) {
    setSelectedLesson(lesson);
    setLessonDraft(initialLessonDraft(lesson));
  }

  async function saveLesson(submitQuiz = false) {
    if (!selectedLesson || !activeCourse) return;
    setStudentNotice(submitQuiz ? "Submitting lesson quiz..." : "Saving lesson...");
    setError("");
    try {
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
        quiz_answers: typeof saved.quiz_answers === "object" && saved.quiz_answers ? saved.quiz_answers : {},
        activity_progress: saved.activity_progress && typeof saved.activity_progress === "object" ? saved.activity_progress : {}
      });
      updateDashboardAfterLesson(selectedLesson, saved, detail);
      setStudentNotice(submitQuiz ? "Lesson quiz submitted." : "Lesson saved.");
      window.setTimeout(() => setStudentNotice(""), 1600);
    } catch (err) {
      setStudentNotice("");
      setError(err.message);
    }
  }

  async function submitQuiz(event) {
    event.preventDefault();
    setError("");
    setQuizSubmitting(true);
    try {
      const result = await api.post(`/student/quizzes/${activeQuiz.quiz_id}/attempts`, { answers });
      setQuizResult(result);
      updateDashboardAfterQuiz(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setQuizSubmitting(false);
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
      updateDashboardAfterTyping(result);
      window.setTimeout(() => setTypingSubmitting(false), 300);
    } catch (err) {
      setError(err.message);
      setTypingSubmitting(false);
    }
  }, [activeTyping, typedText, typingStartedAt, typingResult, typingSubmitting, updateDashboardAfterTyping]);

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
      <aside className="student-sidebar" onPointerEnter={onSidebarPointerEnter} onPointerLeave={onSidebarPointerLeave}>
        <div className="student-brand">
          <Trophy size={28} />
          <div>
            <strong>EduClub</strong>
            <span>Learner</span>
          </div>
        </div>
        <button type="button" className="student-sidebar-toggle" onClick={toggleSidebar} title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}>
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
        {studentNotice ? <div className="student-alert student-success">{studentNotice}</div> : null}
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
              <h2>This Week</h2>
              {weeklyWork.length ? (
                <div className="student-section" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                  {weeklyWork.map((item) => (
                    <button type="button" key={item.id} className="student-week-card" onClick={item.action}>
                      <span>{item.type}</span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </button>
                  ))}
                </div>
              ) : <EmptyState title="No assigned work for this week yet." />}
            </section>
            <section className="student-panel">
              <h2>Course Performance</h2>
              <CourseBars rows={dashboard.course_performance} />
            </section>
            <section className="student-panel">
              <h2>Recent Lesson Progress</h2>
              {dashboard.lesson_progress?.length ? (
                <div className="student-section" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                  {dashboard.lesson_progress.slice(0, 8).map((lesson, index) => (
                    <div key={`lesson-${index}`} className="student-course-card" style={{ cursor: "default" }}>
                      <h3>{lesson.lesson_name || "Untitled Lesson"}</h3>
                      <div className="course-meta">
                        <span>{lesson.course_name || "Course"}</span>
                        {lesson.score != null && <span>Score: {lesson.score}</span>}
                      </div>
                      <div className="course-meta" style={{ marginTop: "8px" }}>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{formatDate(lesson.updated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No lesson progress yet." />}
            </section>
            <section className="student-trend-card">
              <h2>Weekly Quiz Trend</h2>
              {dashboard.weekly_quiz_trend?.length ? (
                <>
                  <div className="trend-summary">
                    <div className="trend-stat">
                      <strong>{numberLabel(dashboard.weekly_quiz_trend.reduce((max, r) => Math.max(max, Number(r.best_score || 0)), 0))}</strong>
                      <span>Best Score</span>
                    </div>
                    <div className="trend-stat">
                      <strong>{numberLabel(dashboard.weekly_quiz_trend.reduce((sum, r) => sum + Number(r.best_score || 0), 0) / dashboard.weekly_quiz_trend.length)}</strong>
                      <span>Average Score</span>
                    </div>
                    <div className="trend-stat">
                      <strong>{dashboard.weekly_quiz_trend.length}</strong>
                      <span>Weeks</span>
                    </div>
                  </div>
                  <TrendChart rows={dashboard.weekly_quiz_trend} valueKey="best_score" valueLabel="Best quiz score" />
                </>
              ) : <EmptyState title="No quiz trend data yet." />}
            </section>
          </div>
        )}

        {!loading && dashboard && activeTab === "courses" && (
          <section className="student-panel">
            <h2>My Courses</h2>
            {dashboard.courses?.length ? (
              <div className="student-section" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                {dashboard.courses.map((course) => <CourseCard key={course.course_id} course={course} />)}
              </div>
            ) : <EmptyState title="No enrolled courses for this term." />}
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
            {dashboard.badges?.length ? (
              <div className="student-section" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {dashboard.badges.map((badge, index) => <BadgeCard key={`${badge.leaderboard_type}-${index}`} badge={badge} />)}
              </div>
            ) : <EmptyState title="No badges or leaderboard entries yet." />}
          </section>
        )}

        {!loading && dashboard && activeTab === "typing" && (
          <div className="student-section">
            <section className="student-panel">
              <h2>Assigned Typing Tests</h2>
              {dashboard.assigned_typing_tests?.length ? (
                <div className="student-section" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                  {dashboard.assigned_typing_tests.map((test) => <TypingCard key={test.typing_test_id} test={test} onStart={openTypingTest} />)}
                </div>
              ) : <EmptyState title="No typing tests assigned for this week." />}
            </section>
            <section className="student-trend-card">
              <h2>Weekly Typing Trend</h2>
              {dashboard.weekly_typing_trend?.length ? (
                <>
                  <div className="trend-summary">
                    <div className="trend-stat">
                      <strong>{numberLabel(dashboard.weekly_typing_trend.reduce((max, r) => Math.max(max, Number(r.best_wpm || 0)), 0))}</strong>
                      <span>Best WPM</span>
                    </div>
                    <div className="trend-stat">
                      <strong>{numberLabel(dashboard.weekly_typing_trend.reduce((sum, r) => sum + Number(r.best_wpm || 0), 0) / dashboard.weekly_typing_trend.length)}</strong>
                      <span>Average WPM</span>
                    </div>
                    <div className="trend-stat">
                      <strong>{dashboard.weekly_typing_trend.length}</strong>
                      <span>Weeks</span>
                    </div>
                  </div>
                  <TrendChart rows={dashboard.weekly_typing_trend} valueKey="best_wpm" valueLabel="Best WPM" />
                </>
              ) : <EmptyState title="No typing trend data yet." />}
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
              {dashboard.assigned_quizzes?.length ? (
                <div className="student-section" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                  {dashboard.assigned_quizzes.map((quiz) => <QuizCard key={quiz.quiz_id} quiz={quiz} onTake={openQuiz} />)}
                </div>
              ) : <EmptyState title="No quizzes assigned for this term." />}
            </section>
            <section className="student-panel">
              <h2>Quiz Results</h2>
              {dashboard.quiz_results?.length ? (
                <div className="student-section" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                  {dashboard.quiz_results.map((quiz, index) => (
                    <div key={`quiz-result-${index}`} className="student-quiz-card" style={{ cursor: "default" }}>
                      <h3>{quiz.quiz_title || "Untitled Quiz"}</h3>
                      <div className="quiz-meta">
                        <span>{formatDate(quiz.created_at)}</span>
                        {quiz.time_taken_seconds != null ? <span>{quiz.time_taken_seconds}s</span> : null}
                      </div>
                      <div className="quiz-score">{numberLabel(quiz.score)}%</div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No quiz attempts for this term." />}
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
                <button type="submit" disabled={quizSubmitting}><CheckCircle2 size={16} />{quizSubmitting ? "Submitting..." : "Submit quiz"}</button>
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
    </main>
  );
}
