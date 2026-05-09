"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  Upload,
  Users
} from "lucide-react";
import { api } from "../../lib/api";
import { currentUser, logout } from "../../lib/auth";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "learners", label: "Learners", icon: Users },
  { id: "term", label: "Term", icon: CalendarDays },
  { id: "submissions", label: "Submissions", icon: Upload },
  { id: "typing", label: "Typing", icon: Gauge },
  { id: "quizzes", label: "Quizzes", icon: ClipboardList },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "leaderboards", label: "Leaderboards", icon: GraduationCap },
  { id: "preferences", label: "Preferences", icon: Settings }
];

function formatDate(value) {
  if (!value) return "First login in this browser session";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function EmptyState({ title, detail }) {
  return (
    <div className="empty-state">
      <p>{title}</p>
      <span>{detail}</span>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <article className={`school-stat ${tone || ""}`}>
      <span>{label}</span>
      <strong>{value ?? "0"}</strong>
    </article>
  );
}

function DataTable({ rows, columns, emptyTitle }) {
  if (!rows?.length) {
    return <EmptyState title={emptyTitle} detail="No real records exist for this school yet." />;
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || `${row.grade}-${row.stream}-${row.name}`}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddLearnerForm({ streams, onCreated }) {
  const [form, setForm] = useState({
    full_name: "",
    grade: "",
    stream: "",
    temporary_password: "Password",
    parent_name: "",
    parent_email: "",
    parent_phone: ""
  });
  const [error, setError] = useState("");

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post("/school-admin/learners", { ...form, grade: Number(form.grade) });
      setForm({ full_name: "", grade: "", stream: "", temporary_password: "Password", parent_name: "", parent_email: "", parent_phone: "" });
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="school-form learner-form" onSubmit={submit}>
      <label>Full name<input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required /></label>
      <label>Grade<input type="number" value={form.grade} onChange={(e) => update("grade", e.target.value)} required /></label>
      <label>Stream<select value={form.stream} onChange={(e) => update("stream", e.target.value)}><option value="">No stream</option>{streams.map((stream) => <option key={stream.id} value={stream.name}>{stream.name}</option>)}</select></label>
      <label>Temporary password<input type="password" value={form.temporary_password} onChange={(e) => update("temporary_password", e.target.value)} /></label>
      <label>Parent name<input value={form.parent_name} onChange={(e) => update("parent_name", e.target.value)} /></label>
      <label>Parent email<input type="email" value={form.parent_email} onChange={(e) => update("parent_email", e.target.value)} /></label>
      <label>Parent phone<input value={form.parent_phone} onChange={(e) => update("parent_phone", e.target.value)} /></label>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit"><Plus size={16} />Add learner</button>
    </form>
  );
}

function BulkLearnerUpload({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResult = await api.upload("/school-admin/learners/bulk-upload", formData);
      setResult(uploadResult);
      onUploaded();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="school-form upload-form" onSubmit={submit}>
      <div>
        <strong>Bulk learner upload</strong>
        <p>Upload a real `.xlsx` or `.csv` file with the first row exactly: child name, grade, stream. Each next row should contain one learner, for example: child name = Mary Wanjiku, grade = 4, stream = Blue. Parent details are not required. Usernames are generated from the child name and every imported learner starts with password Password, with change required on first login.</p>
      </div>
      <input type="file" accept=".xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
      <button type="submit"><Upload size={16} />Upload learners</button>
      {error ? <p className="form-error">{error}</p> : null}
      {result ? (
        <div className="upload-result">
          <p className="success-text">{result.created.length} learners imported. {result.errors.length} row errors.</p>
          {result.errors?.length ? (
            <ul>{result.errors.map((item) => <li key={`${item.row}-${item.error}`}>Row {item.row}: {item.error}</li>)}</ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function CourseAllocationPanel({ learners, courses, onAllocated }) {
  const [courseId, setCourseId] = useState("");
  const [selectedLearners, setSelectedLearners] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function toggleLearner(id) {
    setSelectedLearners((current) => current.includes(id) ? current.filter((learnerId) => learnerId !== id) : [...current, id]);
  }

  async function allocate(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await api.post("/school-admin/course-allocations", { course_id: courseId, learner_ids: selectedLearners });
      setMessage(`${result.count} learner allocations saved.`);
      setSelectedLearners([]);
      setCourseId("");
      onAllocated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel compact-panel">
      <h2>Bulk Allocate Course</h2>
      <form className="allocation-form" onSubmit={allocate}>
        <label>Course<select value={courseId} onChange={(e) => setCourseId(e.target.value)} required><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
        <div className="learner-check-grid">
          {learners.length ? learners.map((learner) => (
            <label className="check-row" key={learner.id}>
              <input type="checkbox" checked={selectedLearners.includes(learner.id)} onChange={() => toggleLearner(learner.id)} />
              {learner.full_name} · Grade {learner.grade}{learner.stream ? ` · ${learner.stream}` : ""}
            </label>
          )) : <span>No learners available.</span>}
        </div>
        <button type="submit"><CheckCircle2 size={16} />Allocate selected learners</button>
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
      </form>
    </section>
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildReportHtml(detail) {
  const report = detail.report || {};
  const learner = report.learner || detail.learner;
  const term = report.term || detail.selected_term;
  const courseRows = (report.courses || []).map((course) => `<tr><td>${escapeHtml(course.course_name)}</td><td>${escapeHtml(course.status)}</td><td>${escapeHtml(course.term_name)}</td></tr>`).join("");
  const quizRows = (detail.quiz_results || []).map((quiz) => `<tr><td>${escapeHtml(quiz.quiz_title || "Untitled quiz")}</td><td>${escapeHtml(quiz.score)}</td><td>${escapeHtml(quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : "")}</td></tr>`).join("");
  const typingRows = (detail.typing_results || []).map((typing) => `<tr><td>${escapeHtml(typing.wpm)}</td><td>${escapeHtml(typing.accuracy)}</td><td>${escapeHtml(typing.created_at ? new Date(typing.created_at).toLocaleDateString() : "")}</td></tr>`).join("");
  const progressRows = (detail.lesson_progress || []).map((item) => `<tr><td>${escapeHtml(item.course_name)}</td><td>${escapeHtml(item.module_name)}</td><td>${escapeHtml(item.lesson_name)}</td><td>${escapeHtml(item.score)}</td></tr>`).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(learner.full_name)} Report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #102033; margin: 32px; }
    h1, h2 { margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; }
    th, td { border: 1px solid #d8e1ef; padding: 8px; text-align: left; }
    th { background: #eef4ff; }
    .meta { color: #536172; }
  </style>
</head>
<body>
  <h1>${escapeHtml(learner.full_name)}</h1>
  <p class="meta">Username: ${escapeHtml(learner.username)} | Grade ${escapeHtml(learner.grade)}${learner.stream ? ` | ${escapeHtml(learner.stream)}` : ""}</p>
  <p class="meta">Term: ${term ? `${escapeHtml(term.year)} ${escapeHtml(term.name)}` : "No selected term"}</p>
  <h2>Course Report</h2>
  <table><thead><tr><th>Course</th><th>Status</th><th>Term</th></tr></thead><tbody>${courseRows || "<tr><td colspan=\"3\">No course records for this term.</td></tr>"}</tbody></table>
  <h2>Quiz Performance</h2>
  <p>Average score: ${report.quiz_summary?.average_score == null ? "No attempts" : Number(report.quiz_summary.average_score).toFixed(1)}</p>
  <table><thead><tr><th>Quiz</th><th>Score</th><th>Date</th></tr></thead><tbody>${quizRows || "<tr><td colspan=\"3\">No quiz records for this term.</td></tr>"}</tbody></table>
  <h2>Typing Performance</h2>
  <p>Average WPM: ${report.typing_summary?.average_wpm == null ? "No attempts" : Number(report.typing_summary.average_wpm).toFixed(1)} | Average accuracy: ${report.typing_summary?.average_accuracy == null ? "No attempts" : `${Number(report.typing_summary.average_accuracy).toFixed(1)}%`}</p>
  <table><thead><tr><th>WPM</th><th>Accuracy</th><th>Date</th></tr></thead><tbody>${typingRows || "<tr><td colspan=\"3\">No typing records for this term.</td></tr>"}</tbody></table>
  <h2>Lesson Progress</h2>
  <table><thead><tr><th>Course</th><th>Module</th><th>Lesson</th><th>Score</th></tr></thead><tbody>${progressRows || "<tr><td colspan=\"4\">No lesson progress yet.</td></tr>"}</tbody></table>
  <h2>Teacher Remarks</h2>
  <p>${escapeHtml(report.teacher_remarks || "No published remarks for this term.")}</p>
</body>
</html>`;
}

function exportLearnerReport(detail) {
  const html = buildReportHtml(detail);
  const learnerName = detail.learner.full_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${learnerName || "learner"}-report.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function LearnerDetailPanel({ detail, streams, terms, onClose, onSaved, onTermChange }) {
  const [form, setForm] = useState({
    full_name: detail.learner.full_name || "",
    grade: detail.learner.grade || "",
    stream: detail.learner.stream || "",
    parent_name: detail.learner.parent_name || "",
    parent_email: detail.learner.parent_email || "",
    parent_phone: detail.learner.parent_phone || ""
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function save(event) {
    event.preventDefault();
    setError("");
    try {
      await api.patch(`/school-admin/learners/${detail.learner.id}`, { ...form, grade: Number(form.grade) });
      onSaved(detail.learner.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function promote(mode) {
    setError("");
    setMessage("");
    try {
      const result = await api.post(`/school-admin/learners/${detail.learner.id}/promotions`, { mode, stream: form.stream || null });
      setMessage(mode === "next_grade" ? `${result.full_name} moved to Grade ${result.grade}.` : `${result.full_name} marked ready for the next term.`);
      onSaved(detail.learner.id);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="learner-detail-backdrop">
    <section className="learner-detail-panel" role="dialog" aria-modal="true" aria-label={`${detail.learner.full_name} details`}>
      <div className="detail-header">
        <div>
          <p className="eyebrow">Learner profile</p>
          <h2>{detail.learner.full_name}</h2>
          <p>{detail.learner.username} · Grade {detail.learner.grade}{detail.learner.stream ? ` · ${detail.learner.stream}` : ""}</p>
        </div>
        <div className="detail-actions">
          <label>Report term
            <select value={detail.selected_term?.id || ""} onChange={(e) => onTermChange(detail.learner.id, e.target.value)}>
              <option value="">Active term</option>
              {terms.map((term) => <option key={term.id} value={term.id}>{term.year} - {term.name}{term.is_active ? " (active)" : ""}</option>)}
            </select>
          </label>
          <button type="button" className="secondary-button" onClick={() => exportLearnerReport(detail)}><Download size={16} />Export report</button>
          <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        </div>
      </div>
      <form className="school-form learner-edit-form" onSubmit={save}>
        <label>Full name<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
        <label>Grade<input type="number" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} required /></label>
        <label>Stream<select value={form.stream} onChange={(e) => setForm({ ...form, stream: e.target.value })}><option value="">No stream</option>{streams.map((stream) => <option key={stream.id} value={stream.name}>{stream.name}</option>)}</select></label>
        <label>Parent name<input value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} /></label>
        <label>Parent email<input type="email" value={form.parent_email} onChange={(e) => setForm({ ...form, parent_email: e.target.value })} /></label>
        <label>Parent phone<input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} /></label>
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="success-text">{message}</p> : null}
        <button type="submit"><CheckCircle2 size={16} />Save learner</button>
      </form>
      <section className="promotion-panel">
        <div>
          <h3>Promotion Controls</h3>
          <p>Use next term when the learner continues in the same grade. Use next grade after the academic year is complete.</p>
        </div>
        <div className="promotion-actions">
          <button type="button" className="secondary-button" onClick={() => promote("next_term")}>Promote to next term</button>
          <button type="button" onClick={() => promote("next_grade")}><CheckCircle2 size={16} />Promote to next grade</button>
        </div>
      </section>
      <div className="learner-history-grid">
        <section className="panel compact-panel">
          <h3>Report Summary</h3>
          <div className="report-summary-grid">
            <Stat label="Courses" value={detail.report?.courses?.length || 0} />
            <Stat label="Quiz avg" value={detail.report?.quiz_summary?.average_score == null ? "-" : Number(detail.report.quiz_summary.average_score).toFixed(1)} />
            <Stat label="Typing WPM" value={detail.report?.typing_summary?.average_wpm == null ? "-" : Number(detail.report.typing_summary.average_wpm).toFixed(1)} />
          </div>
        </section>
        <section className="panel compact-panel"><h3>Course History</h3><DataTable rows={detail.course_history} emptyTitle="No course history yet" columns={[{ key: "course_name", label: "Course" }, { key: "term_name", label: "Term" }, { key: "year", label: "Year" }, { key: "status", label: "Status" }]} /></section>
        <section className="panel compact-panel"><h3>Submissions</h3><DataTable rows={detail.submissions} emptyTitle="No submissions yet" columns={[{ key: "file_url", label: "File" }, { key: "status", label: "Status" }, { key: "feedback", label: "Feedback", render: (row) => row.feedback || "-" }]} /></section>
        <section className="panel compact-panel"><h3>Reports</h3><DataTable rows={detail.reports} emptyTitle="No report cards yet" columns={[{ key: "year", label: "Year" }, { key: "term_name", label: "Term" }, { key: "published_at", label: "Published", render: (row) => row.published_at ? formatDate(row.published_at) : "-" }]} /></section>
        <section className="panel compact-panel"><h3>Performance</h3><DataTable rows={detail.lesson_progress} emptyTitle="No lesson performance yet" columns={[{ key: "course_name", label: "Course" }, { key: "lesson_name", label: "Lesson" }, { key: "score", label: "Score", render: (row) => row.score ?? "-" }]} /></section>
        <section className="panel compact-panel"><h3>Quizzes</h3><DataTable rows={detail.quiz_results} emptyTitle="No quiz results for this term" columns={[{ key: "quiz_title", label: "Quiz", render: (row) => row.quiz_title || "Untitled quiz" }, { key: "score", label: "Score" }, { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }]} /></section>
        <section className="panel compact-panel"><h3>Typing</h3><DataTable rows={detail.typing_results} emptyTitle="No typing results for this term" columns={[{ key: "wpm", label: "WPM" }, { key: "accuracy", label: "Accuracy", render: (row) => `${Number(row.accuracy || 0).toFixed(1)}%` }, { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }]} /></section>
      </div>
    </section>
    </div>
  );
}

function PreferencesPanel({ preferences, streams, onRefresh }) {
  const [pref, setPref] = useState(preferences || {});
  const [streamName, setStreamName] = useState("");

  useEffect(() => {
    setPref(preferences || {});
  }, [preferences]);

  async function savePreferences(event) {
    event.preventDefault();
    await api.patch("/school-admin/preferences", {
      typing_passage_words: Number(pref.typing_passage_words || 300),
      typing_timer_seconds: Number(pref.typing_timer_seconds || 300),
      module_pass_threshold: Number(pref.module_pass_threshold || 60),
      leaderboards_visible: Boolean(pref.leaderboards_visible),
      ai_enabled: Boolean(pref.ai_enabled),
      notification_preferences: pref.notification_preferences || {},
      report_header_fields: pref.report_header_fields || {}
    });
    onRefresh();
  }

  async function addStream(event) {
    event.preventDefault();
    await api.post("/school-admin/streams", { name: streamName });
    setStreamName("");
    onRefresh();
  }

  return (
    <div className="preference-grid">
      <form className="school-form preferences-form" onSubmit={savePreferences}>
        <label>Typing words<input type="number" min="300" max="500" value={pref.typing_passage_words || 300} onChange={(e) => setPref({ ...pref, typing_passage_words: e.target.value })} /></label>
        <label>Typing timer seconds<input type="number" min="300" max="500" value={pref.typing_timer_seconds || 300} onChange={(e) => setPref({ ...pref, typing_timer_seconds: e.target.value })} /></label>
        <label>Module pass threshold<input type="number" min="0" max="100" value={pref.module_pass_threshold || 60} onChange={(e) => setPref({ ...pref, module_pass_threshold: e.target.value })} /></label>
        <label className="check-row"><input type="checkbox" checked={Boolean(pref.leaderboards_visible)} onChange={(e) => setPref({ ...pref, leaderboards_visible: e.target.checked })} />Student leaderboards visible</label>
        <label className="check-row"><input type="checkbox" checked={Boolean(pref.ai_enabled)} onChange={(e) => setPref({ ...pref, ai_enabled: e.target.checked })} />AI hints and analytics enabled</label>
        <button type="submit"><CheckCircle2 size={16} />Save preferences</button>
      </form>
      <section className="panel compact-panel">
        <h2>Streams</h2>
        <form className="stream-form" onSubmit={addStream}>
          <label>Stream name<input value={streamName} onChange={(e) => setStreamName(e.target.value)} required /></label>
          <button type="submit"><Plus size={16} />Add stream</button>
        </form>
        <DataTable rows={streams} emptyTitle="No streams configured yet" columns={[
          { key: "name", label: "Stream" }
        ]} />
      </section>
    </div>
  );
}

export default function SchoolAdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [user, setUser] = useState(null);
  const [state, setState] = useState({
    profile: null,
    summary: null,
    enrolment: [],
    progress: [],
    learners: [],
    submissions: [],
    typing: [],
    quizzes: [],
    leaderboards: [],
    preferences: null,
    streams: [],
    courses: [],
    terms: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [learnerFilters, setLearnerFilters] = useState({ search: "", grade: "", stream: "" });
  const [learnerDetail, setLearnerDetail] = useState(null);

  const activeTermLabel = useMemo(() => {
    const term = state.summary?.active_term;
    return term ? `${term.year} - ${term.name}` : "No active term";
  }, [state.summary]);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const requests = {
        profile: api.get("/school-admin/profile"),
        summary: api.get("/school-admin/summary"),
        enrolment: api.get("/school-admin/enrolment-by-course"),
        progress: api.get("/school-admin/class-progress"),
        learners: api.get("/school-admin/learners"),
        submissions: api.get("/school-admin/submissions"),
        typing: api.get("/school-admin/typing-results"),
        quizzes: api.get("/school-admin/quiz-results"),
        leaderboards: api.get("/school-admin/leaderboards"),
        preferences: api.get("/school-admin/preferences"),
        streams: api.get("/school-admin/streams"),
        courses: api.get("/school-admin/courses"),
        terms: api.get("/school-admin/terms")
      };
      const entries = await Promise.all(Object.entries(requests).map(async ([key, promise]) => {
        try {
          return [key, await promise, null];
        } catch (err) {
          return [key, null, err.message];
        }
      }));
      const data = Object.fromEntries(entries.map(([key, value]) => [key, value]));
      const failures = entries.filter(([, , failure]) => failure);
      if (failures.length) {
        setError(failures.map(([key, , failure]) => `${key}: ${failure}`).join(" | "));
      }
      setState({
        profile: data.profile,
        summary: data.summary,
        enrolment: data.enrolment || [],
        progress: data.progress || [],
        learners: data.learners?.data || [],
        submissions: data.submissions?.data || [],
        typing: data.typing?.data || [],
        quizzes: data.quizzes?.data || [],
        leaderboards: data.leaderboards?.data || [],
        preferences: data.preferences,
        streams: data.streams || [],
        courses: data.courses || [],
        terms: data.terms || []
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadLearnersWithFilters(filters = learnerFilters) {
    const query = new URLSearchParams();
    if (filters.search) query.set("search", filters.search);
    if (filters.grade) query.set("grade", filters.grade);
    if (filters.stream) query.set("stream", filters.stream);
    const learners = await api.get(`/school-admin/learners${query.toString() ? `?${query}` : ""}`);
    setState((current) => ({ ...current, learners: learners.data }));
  }

  async function applyLearnerFilters(event) {
    event.preventDefault();
    await loadLearnersWithFilters();
  }

  async function openLearnerDetail(id, termId = "") {
    const query = termId ? `?term_id=${encodeURIComponent(termId)}` : "";
    const detail = await api.get(`/school-admin/learners/${id}/detail${query}`);
    setLearnerDetail(detail);
  }

  async function refreshLearnerDetail(id) {
    await loadDashboard();
    if (id) {
      await openLearnerDetail(id, learnerDetail?.selected_term?.id || "");
    }
  }

  useEffect(() => {
    const sessionUser = currentUser();
    if (!sessionUser || sessionUser.role !== "school_admin") {
      window.location.href = "/login";
      return;
    }
    setUser(sessionUser);
    loadDashboard();
  }, []);

  return (
    <main className="school-shell">
      <aside className="school-sidebar">
        <div className="school-brand">
          <Sparkles size={28} />
          <div>
            <strong>EduClub</strong>
            <span>School Admin</span>
          </div>
        </div>
        <nav>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}><Icon size={18} />{tab.label}</button>;
          })}
        </nav>
        <button className="logout-button" onClick={logout}><LogOut size={18} />Sign out</button>
      </aside>

      <section className="school-main">
        <header className="school-hero">
          <div>
            <p className="eyebrow">Active term: {activeTermLabel}</p>
            <h1>{state.profile?.school_name || "Your school"} learning studio</h1>
            <p>Guide learners, review work, track typing growth, manage streams, and keep report cards moving with quiet confidence.</p>
          </div>
          <div className="last-login-card">
            <Bell size={20} />
            <span>Last login</span>
            <strong>{formatDate(user?.previous_login_at || state.profile?.previous_login_at)}</strong>
          </div>
        </header>

        {error ? <div className="alert">{error}</div> : null}
        {loading ? <div className="loading-block">Loading your school workspace...</div> : null}

        {!loading && activeTab === "overview" && (
          <div className="school-section">
            <div className="school-stats">
              <Stat label="Learners" value={state.summary?.totals?.learners} tone="blue" />
              <Stat label="Active courses" value={state.summary?.totals?.active_courses} tone="green" />
              <Stat label="Pending submissions" value={state.summary?.totals?.pending_submissions} tone="gold" />
              <Stat label="Report cards" value={state.summary?.totals?.report_cards} tone="coral" />
            </div>
            <section className="growth-card">
              <div>
                <p className="eyebrow">Club growth</p>
                <h2>Term enrolment pulse</h2>
                <p>Growth comparison appears once current and previous term enrolments exist for this school.</p>
              </div>
              <BarChart3 size={74} />
            </section>
            <section className="panel">
              <h2>Enrolment Per Course</h2>
              <DataTable rows={state.enrolment} emptyTitle="No course enrolments this term" columns={[
                { key: "name", label: "Course" },
                { key: "enrolment_count", label: "Learners" }
              ]} />
            </section>
            <section className="panel">
              <h2>Class Progress Overview</h2>
              <DataTable rows={state.progress} emptyTitle="No learner progress yet" columns={[
                { key: "grade", label: "Grade", render: (row) => row.grade || "-" },
                { key: "stream", label: "Stream", render: (row) => row.stream || "-" },
                { key: "learner_count", label: "Learners" },
                { key: "average_score", label: "Avg score", render: (row) => row.average_score ? Number(row.average_score).toFixed(1) : "-" }
              ]} />
            </section>
          </div>
        )}

        {!loading && activeTab === "learners" && (
          <section className="panel">
            <h2>Learner Management</h2>
            <form className="learner-filter-form" onSubmit={applyLearnerFilters}>
              <label>Search<input value={learnerFilters.search} onChange={(e) => setLearnerFilters({ ...learnerFilters, search: e.target.value })} placeholder="Name or username" /></label>
              <label>Grade<input type="number" value={learnerFilters.grade} onChange={(e) => setLearnerFilters({ ...learnerFilters, grade: e.target.value })} /></label>
              <label>Stream<select value={learnerFilters.stream} onChange={(e) => setLearnerFilters({ ...learnerFilters, stream: e.target.value })}><option value="">All streams</option>{state.streams.map((stream) => <option key={stream.id} value={stream.name}>{stream.name}</option>)}</select></label>
              <button type="submit">Apply filters</button>
            </form>
            <AddLearnerForm streams={state.streams} onCreated={loadDashboard} />
            <BulkLearnerUpload onUploaded={loadDashboard} />
            <DataTable rows={state.learners} emptyTitle="No learners in this school yet" columns={[
              { key: "full_name", label: "Learner", render: (row) => <button type="button" className="link-button" onClick={() => openLearnerDetail(row.id)}>{row.full_name}</button> },
              { key: "username", label: "Username" },
              { key: "grade", label: "Grade" },
              { key: "stream", label: "Stream", render: (row) => row.stream || "-" },
              { key: "parent_email", label: "Parent email", render: (row) => row.parent_email || "-" }
            ]} />
            {learnerDetail ? <LearnerDetailPanel detail={learnerDetail} streams={state.streams} terms={state.terms} onClose={() => setLearnerDetail(null)} onSaved={refreshLearnerDetail} onTermChange={openLearnerDetail} /> : null}
          </section>
        )}

        {!loading && activeTab === "term" && (
          <section className="panel">
            <h2>Term Management</h2>
            <div className="workflow-grid">
              {["Pull last term", "Remove opted-out", "Add new learners", "Allocate courses", "Publish term"].map((step, index) => (
                <article className="workflow-step" key={step}><strong>{index + 1}</strong><span>{step}</span></article>
              ))}
            </div>
            <CourseAllocationPanel learners={state.learners} courses={state.courses} onAllocated={loadDashboard} />
            <EmptyState title="Term workflow controls are staged" detail="The dashboard reads active term data now. The next build pass will wire the term enrolment wizard actions." />
          </section>
        )}

        {!loading && activeTab === "submissions" && (
          <section className="panel">
            <h2>Pending Submissions Queue</h2>
            <DataTable rows={state.submissions} emptyTitle="No submissions yet" columns={[
              { key: "learner_name", label: "Learner" },
              { key: "status", label: "Status" },
              { key: "file_url", label: "File" },
              { key: "created_at", label: "Submitted", render: (row) => formatDate(row.created_at) }
            ]} />
          </section>
        )}

        {!loading && activeTab === "typing" && (
          <section className="panel">
            <h2>Typing Test Results</h2>
            <DataTable rows={state.typing} emptyTitle="No typing results yet" columns={[
              { key: "learner_name", label: "Learner" },
              { key: "wpm", label: "WPM" },
              { key: "accuracy", label: "Accuracy", render: (row) => `${Number(row.accuracy || 0).toFixed(1)}%` },
              { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }
            ]} />
          </section>
        )}

        {!loading && activeTab === "quizzes" && (
          <section className="panel">
            <h2>Quiz Results Overview</h2>
            <DataTable rows={state.quizzes} emptyTitle="No quiz attempts yet" columns={[
              { key: "quiz_title", label: "Quiz", render: (row) => row.quiz_title || "Untitled quiz" },
              { key: "learner_name", label: "Learner" },
              { key: "score", label: "Score" },
              { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }
            ]} />
          </section>
        )}

        {!loading && activeTab === "reports" && (
          <section className="panel">
            <h2>Report Card Shortcuts</h2>
            <div className="shortcut-grid">
              <button><FileText size={18} />Generate individual</button>
              <button><Users size={18} />Generate class</button>
              <button><BookOpen size={18} />Generate whole school</button>
            </div>
            <EmptyState title="Report generation is ready for live data wiring" detail="The report shell is present; PDF generation will be connected once learner/course scoring flows are complete." />
          </section>
        )}

        {!loading && activeTab === "leaderboards" && (
          <section className="panel">
            <h2>School Leaderboards</h2>
            <DataTable rows={state.leaderboards} emptyTitle="No leaderboard entries yet" columns={[
              { key: "leaderboard_type", label: "Type" },
              { key: "rank", label: "Rank" },
              { key: "learner_name", label: "Learner" },
              { key: "score", label: "Score" }
            ]} />
          </section>
        )}

        {!loading && activeTab === "preferences" && (
          <PreferencesPanel preferences={state.preferences} streams={state.streams} onRefresh={loadDashboard} />
        )}
      </section>
    </main>
  );
}
