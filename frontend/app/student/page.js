"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const SIDEBAR_HIDE_DELAY_MS = 420;

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

function CourseCard({ course, onOpen }) {
  const progress = course.progress || 0;
  return (
    <div className="student-course-card" onClick={() => onOpen(course)}>
      <h3>{course.course_name || "Untitled Course"}</h3>
      <div className="course-meta">
        <span>{course.club || "No club"}</span>
        <span>{course.status || "Active"}</span>
        <span>{course.term_name || "Current term"}</span>
      </div>
      <div className="course-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="progress-text">{progress.toFixed(0)}% complete</div>
      </div>
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

function LessonPlayerWorkspace({ course, selectedLesson, lessonDraft, setLessonDraft, onSelectLesson, onSaveLesson, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = Array.isArray(selectedLesson?.player_steps) ? selectedLesson.player_steps : [];
  const safeIndex = Math.min(Math.max(stepIndex, 0), Math.max(steps.length - 1, 0));
  const step = steps[safeIndex];
  const quizQuestions = step?.activity_type === "quiz" ? step.payload?.questions || [] : [];

  useEffect(() => {
    setStepIndex(0);
  }, [selectedLesson?.id]);

  const practiceCode =
    step?.step_id === "legacy:practice"
      ? lessonDraft.practice_code ?? selectedLesson?.practice_code ?? selectedLesson?.starter_code ?? selectedLesson?.example ?? ""
      : lessonDraft.activity_progress?.[step?.step_id]?.code ??
        lessonDraft.activity_progress?.[step?.step_id]?.starterCode ??
        step?.payload?.starterCode ??
        "";

  function setPracticeCode(value) {
    if (step?.step_id === "legacy:practice") {
      setLessonDraft((d) => ({ ...d, practice_code: value }));
    } else if (step?.step_id) {
      setLessonDraft((d) => patchActivityProgress(d, step.step_id, { code: value }));
    }
  }

  function renderStepBody() {
    if (!step) return <EmptyState title="This lesson has no player steps yet." />;
    const p = step.payload || {};
    switch (step.activity_type) {
      case "learn_content":
        return (
          <div className="lesson-player-learn">
            {p.teacherNotes ? <p className="lesson-player-note"><strong>Teacher note:</strong> {p.teacherNotes}</p> : null}
            {p.codeExample ? <pre className="lesson-player-code">{p.codeExample}</pre> : null}
            <div className="lesson-player-rich">{String(p.richText || "").split("\n").map((line, i) => <p key={i}>{line}</p>)}</div>
          </div>
        );
      case "practice": {
        const lang = String(p.language || "html").toLowerCase();
        const showPreview = lang === "html";
        return (
          <div>
            <p>{p.instructions}</p>
            {p.expectedHints ? <p className="lesson-player-note">{p.expectedHints}</p> : null}
            <div className={showPreview ? "code-playground" : ""}>
              <textarea value={practiceCode} onChange={(e) => setPracticeCode(e.target.value)} rows={showPreview ? 12 : 16} />
              {showPreview ? <iframe title="Live preview" srcDoc={practiceCode} sandbox="allow-scripts" /> : null}
            </div>
          </div>
        );
      }
      case "creative_corner": {
        const creativeVal =
          step.step_id === "legacy:creativity"
            ? lessonDraft.creativity_code ?? selectedLesson?.creativity_code ?? ""
            : lessonDraft.activity_progress?.[step.step_id]?.text ?? "";
        const setCreative = (value) => {
          if (step.step_id === "legacy:creativity") {
            setLessonDraft((d) => ({ ...d, creativity_code: value }));
          } else {
            setLessonDraft((d) => patchActivityProgress(d, step.step_id, { text: value }));
          }
        };
        return (
          <div>
            <p>{p.instructions}</p>
            <textarea value={creativeVal} onChange={(e) => setCreative(e.target.value)} rows={10} />
          </div>
        );
      }
      case "teacher_task":
        return (
          <div>
            <p>{p.instructions || p.expectedOutputDescription}</p>
            <textarea
              value={lessonDraft.activity_progress?.[step.step_id]?.text ?? ""}
              onChange={(e) => setLessonDraft((d) => patchActivityProgress(d, step.step_id, { text: e.target.value }))}
              rows={8}
            />
          </div>
        );
      case "submission": {
        const textVal = step.source === "legacy"
          ? lessonDraft.homework_code ?? selectedLesson?.homework_code ?? ""
          : lessonDraft.activity_progress?.[step.step_id]?.text ?? "";
        const setText = (value) => {
          if (step.step_id === "legacy:homework") {
            setLessonDraft((d) => ({ ...d, homework_code: value }));
          } else {
            setLessonDraft((d) => patchActivityProgress(d, step.step_id, { text: value }));
          }
        };
        return (
          <div>
            <p>{p.instructions}</p>
            <textarea value={textVal} onChange={(e) => setText(e.target.value)} rows={10} />
          </div>
        );
      }
      case "quiz":
        return (
          <div>
            {quizQuestions.map((question, index) => {
              const opts = question.options || [];
              const draftAnswers =
                step.source === "legacy"
                  ? lessonDraft.quiz_answers || {}
                  : lessonDraft.activity_progress?.[step.step_id]?.answers || {};
              const setAnswer = (value) => {
                if (step.source === "legacy") {
                  setLessonDraft((d) => ({ ...d, quiz_answers: { ...(d.quiz_answers || {}), [index]: value } }));
                } else {
                  const next = { ...(lessonDraft.activity_progress?.[step.step_id]?.answers || {}), [index]: value };
                  setLessonDraft((d) => patchActivityProgress(d, step.step_id, { answers: next }));
                }
              };
              return (
                <fieldset key={`${step.step_id}-q-${index}`} className="mini-quiz-question">
                  <legend>
                    {index + 1}. {question.question}
                  </legend>
                  {opts.map((option) => (
                    <label key={String(option)}>
                      <input
                        type="radio"
                        name={`${selectedLesson.id}-${step.step_id}-${index}`}
                        checked={draftAnswers[index] === option}
                        onChange={() => setAnswer(option)}
                      />
                      {option}
                    </label>
                  ))}
                </fieldset>
              );
            })}
          </div>
        );
      default:
        return <p className="lesson-player-note">This activity type is not rendered yet. Your teacher can still review saved work.</p>;
    }
  }

  return (
    <div className="quiz-take-backdrop">
      <section className="course-workspace" role="dialog" aria-modal="true" aria-label={course.name}>
        <div className="quiz-take-header">
          <div>
            <p className="eyebrow">{courseTrackLabel(course.technology)}</p>
            <h2>{course.name}</h2>
            <p>{course.objectives}</p>
          </div>
          <button type="button" className="student-secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="course-workspace-grid">
          <aside className="module-list">
            {course.modules.map((module) => (
              <section key={module.id}>
                <h3>
                  {module.sort_order}. {module.name}
                </h3>
                <p>{module.is_locked ? "Locked until your teacher opens it." : module.badge_name}</p>
                {module.lessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    disabled={module.is_locked}
                    className={selectedLesson?.id === lesson.id ? "active" : ""}
                    onClick={() => onSelectLesson(lesson)}
                  >
                    {lesson.name}
                  </button>
                ))}
              </section>
            ))}
          </aside>
          {selectedLesson ? (
            <div className="lesson-player">
              <header className="lesson-player-header">
                <div>
                  <p className="eyebrow">
                    {steps.length ? `Step ${safeIndex + 1} of ${steps.length}` : "No activities yet"}
                  </p>
                  <h3>{selectedLesson.name}</h3>
                  {selectedLesson.lesson_objectives ? <p>{selectedLesson.lesson_objectives}</p> : null}
                </div>
                <div className="lesson-player-score">
                  {selectedLesson.score != null ? <strong>{Number(selectedLesson.score).toFixed(1)}%</strong> : <span>Not graded yet</span>}
                </div>
              </header>
              <div className="lesson-player-progress">
                {steps.map((s, i) => (
                  <button
                    key={s.step_id}
                    type="button"
                    className={`lesson-player-dot ${i === safeIndex ? "active" : ""} ${i < safeIndex ? "done" : ""}`}
                    onClick={() => setStepIndex(i)}
                    title={s.title}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              {step ? (
                <section className="lesson-player-step">
                  <h4>{step.title}</h4>
                  {renderStepBody()}
                </section>
              ) : null}
              <div className="lesson-action-row lesson-player-nav">
                <button type="button" className="student-secondary" disabled={safeIndex <= 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
                  Previous step
                </button>
                <button type="button" className="student-secondary" disabled={safeIndex >= steps.length - 1} onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}>
                  Next step
                </button>
                <button type="button" onClick={() => onSaveLesson(false)}>
                  Save progress
                </button>
                <button type="button" onClick={() => onSaveLesson(true)}>
                  Submit quiz
                </button>
              </div>
            </div>
          ) : (
            <EmptyState title="Choose an open lesson to begin." />
          )}
        </div>
      </section>
    </div>
  );
}

export default function StudentPage() {
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
                {dashboard.courses.map((course) => <CourseCard key={course.course_id} course={course} onOpen={openCourse} />)}
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
                        <span>{quiz.time_taken_seconds}s</span>
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
        <LessonPlayerWorkspace
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
