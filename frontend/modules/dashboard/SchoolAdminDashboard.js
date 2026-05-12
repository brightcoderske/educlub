"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Sparkles,
  Upload,
  Users
} from "lucide-react";
import { api, assetUrl } from "../../lib/api";
import { currentUser, logout } from "../../lib/auth";
import ReportCard from "./ReportCard";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "learners", label: "Learners", icon: Users },
  { id: "term", label: "Term", icon: CalendarDays },
  { id: "courses", label: "Courses", icon: BookOpen },
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
  const rowKey = (row, index) => {
    return row.id || row.assignment_id || row.quiz_id || row.course_id || row.learner_id || row.created_at || `${row.grade || "row"}-${row.stream || "none"}-${row.name || row.title || row.quiz_title || index}-${index}`;
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

function QuizTrendChart({ rows }) {
  if (!rows?.length) return <EmptyState title="No weekly quiz trend yet" detail="When learners attempt quizzes across weeks, the line graph appears here." />;
  const width = 520;
  const height = 180;
  const padding = 28;
  const scores = rows.map((row) => Number(row.average_score || 0));
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (rows.length - 1);
    const y = height - padding - (Number(row.average_score || 0) / 100) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weekly quiz performance trend">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
        <polyline points={points} />
        {rows.map((row, index) => {
          const x = rows.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (rows.length - 1);
          const y = height - padding - (Number(row.average_score || 0) / 100) * (height - padding * 2);
          return <circle key={row.week_start || index} cx={x} cy={y} r="5" />;
        })}
      </svg>
      <div className="trend-labels">
        {rows.map((row, index) => <span key={row.week_start || index}>Week {index + 1}: {Number(scores[index]).toFixed(1)}</span>)}
      </div>
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
  const [moduleAvailability, setModuleAvailability] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedCourse = courses.find((course) => course.id === courseId);

  function toggleLearner(id) {
    setSelectedLearners((current) => current.includes(id) ? current.filter((learnerId) => learnerId !== id) : [...current, id]);
  }

  async function allocate(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await api.post("/school-admin/course-allocations", { course_id: courseId, learner_ids: selectedLearners, module_availability: moduleAvailability });
      setMessage(`${result.count} learner allocations saved.`);
      setSelectedLearners([]);
      setCourseId("");
      setModuleAvailability({});
      onAllocated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel compact-panel">
      <h2>Bulk Allocate Course</h2>
      <form className="allocation-form" onSubmit={allocate}>
        <label>Course<select value={courseId} onChange={(e) => { setCourseId(e.target.value); setModuleAvailability({}); }} required><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
        {selectedCourse?.modules?.length ? (
          <div className="module-availability-grid">
            <p className="helper-text">Module dates are lock dates. Leave blank to open a module immediately; choose a date/time to keep that module closed until then.</p>
            {selectedCourse.modules.map((module) => (
              <label key={module.id}>Closed until: Module {module.sort_order} - {module.name}<input type="datetime-local" value={moduleAvailability[module.id] || ""} onChange={(e) => setModuleAvailability({ ...moduleAvailability, [module.id]: e.target.value })} /></label>
            ))}
          </div>
        ) : null}
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

function GradeChecks({ value, onChange, allowed }) {
  const grades = value || [];
  const allowedSet = allowed?.length ? allowed : Array.from({ length: 9 }, (_, index) => index + 1);
  function toggle(grade) {
    onChange(grades.includes(grade) ? grades.filter((item) => item !== grade) : [...grades, grade].sort((a, b) => a - b));
  }
  return (
    <div className="grade-checks">
      {allowedSet.map((grade) => (
        <label className="check-row" key={grade}>
          <input type="checkbox" checked={grades.includes(grade)} onChange={() => toggle(grade)} />
          Grade {grade}
        </label>
      ))}
    </div>
  );
}

function CreateSchoolQuizForm({ onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", grade_levels: [1], max_attempts: 1 });
  const [question, setQuestion] = useState({ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A" });
  const [createdQuiz, setCreatedQuiz] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function createQuiz(event) {
    event.preventDefault();
    setError("");
    try {
      const quiz = await api.post("/school-admin/school-quizzes", form);
      setCreatedQuiz(quiz);
      setForm({ title: "", description: "", grade_levels: [1], max_attempts: 1 });
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addQuestion(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post(`/school-admin/school-quizzes/${createdQuiz.id}/questions`, question);
      setQuestion({ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A" });
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadQuestions(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const formData = new FormData();
    formData.append("file", uploadFile);
    try {
      const result = await api.upload(`/school-admin/school-quizzes/${createdQuiz.id}/questions/upload`, formData);
      setMessage(`${result.created.length} questions imported. ${result.errors.length} row errors.`);
      setUploadFile(null);
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel compact-panel">
      <h3>Create School Quiz</h3>
      <form className="school-form" onSubmit={createQuiz}>
        <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
        <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label>Max attempts<input type="number" min="1" max="20" value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: Number(e.target.value) })} /></label>
        <GradeChecks value={form.grade_levels} onChange={(grades) => setForm({ ...form, grade_levels: grades })} />
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit"><Plus size={16} />Create quiz</button>
      </form>
      {createdQuiz ? (
        <>
          <form className="question-form" onSubmit={addQuestion}>
            <p className="success-text">Adding questions to {createdQuiz.title}</p>
            {message ? <p className="success-text">{message}</p> : null}
            <label>Question<textarea value={question.question} onChange={(e) => setQuestion({ ...question, question: e.target.value })} required /></label>
            <div className="option-grid">
              {["option_a", "option_b", "option_c", "option_d"].map((key) => <label key={key}>{key.replace("_", " ").toUpperCase()}<input value={question[key]} onChange={(e) => setQuestion({ ...question, [key]: e.target.value })} required /></label>)}
            </div>
            <label>Correct option<select value={question.correct_option} onChange={(e) => setQuestion({ ...question, correct_option: e.target.value })}><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
            <button type="submit"><Plus size={16} />Add question</button>
          </form>
          <form className="inline-form" onSubmit={uploadQuestions}>
            <label>Bulk questions CSV/XLSX<input type="file" accept=".csv,.xlsx" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} required /></label>
            <button type="submit"><Upload size={16} />Upload questions</button>
            <p className="helper-text">Columns: question, option_a, option_b, option_c, option_d, correct_option.</p>
          </form>
        </>
      ) : null}
    </section>
  );
}

function QuizAssignmentPanel({ globalQuizzes, schoolQuizzes, assignments, performance, onRefresh }) {
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [grades, setGrades] = useState([]);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const allQuizzes = [...globalQuizzes, ...schoolQuizzes];
  const selectedQuiz = allQuizzes.find((quiz) => quiz.id === selectedQuizId);

  async function assign(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await api.post(`/school-admin/quizzes/${selectedQuizId}/assign`, {
        grades,
        max_attempts: Number(maxAttempts || 1),
        available_from: availableFrom || null,
        available_until: availableUntil || null
      });
      setMessage(`${result.count} quiz assignment rows saved.`);
      setGrades([]);
      setSelectedQuizId("");
      setAvailableFrom("");
      setAvailableUntil("");
      onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="quiz-school-grid">
      <section className="panel compact-panel">
        <h3>Assign Quiz To Grade</h3>
        <form className="school-form" onSubmit={assign}>
          <label>Quiz<select value={selectedQuizId} onChange={(e) => { setSelectedQuizId(e.target.value); setGrades([]); }} required><option value="">Select quiz</option>{allQuizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title} {quiz.is_global ? "(global)" : "(school)"}</option>)}</select></label>
          {selectedQuiz ? <p className="helper-text">Available to Grade {selectedQuiz.grade_levels?.join("-")}. The backend enforces this if someone tries another grade.</p> : null}
          <GradeChecks value={grades} allowed={selectedQuiz?.grade_levels} onChange={setGrades} />
          <label>Attempts allowed<input type="number" min="1" max="20" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} /></label>
          <label>Available from<input type="datetime-local" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} /></label>
          <label>Available until<input type="datetime-local" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} /></label>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}
          <button type="submit"><CheckCircle2 size={16} />Assign quiz</button>
        </form>
      </section>
      <section className="panel compact-panel">
        <h3>Assignments</h3>
        <DataTable rows={assignments} emptyTitle="No quizzes assigned yet" columns={[
          { key: "title", label: "Quiz" },
          { key: "grade", label: "Grade" },
          { key: "learner_count", label: "Learners" },
          { key: "max_attempts", label: "Attempts" },
          { key: "available_until", label: "Available until", render: (row) => row.available_until ? formatDate(row.available_until) : "Open" }
        ]} />
      </section>
      <section className="panel compact-panel">
        <h3>Quiz Performance</h3>
        <DataTable rows={performance} emptyTitle="No quiz attempts yet" columns={[
          { key: "quiz_title", label: "Quiz", render: (row) => row.quiz_title || "Untitled quiz" },
          { key: "attempts", label: "Attempts" },
          { key: "average_score", label: "Avg", render: (row) => row.average_score ? Number(row.average_score).toFixed(1) : "-" },
          { key: "expectation", label: "Band" }
        ]} />
      </section>
    </div>
  );
}

function TypingTestPanel({ globalTests, schoolTests, assignments, performance, onRefresh }) {
  const [form, setForm] = useState({ title: "", passage: "", duration_seconds: 300, max_attempts: 3, grade_levels: [1] });
  const [editingTestId, setEditingTestId] = useState("");
  const [selectedTestId, setSelectedTestId] = useState("");
  const [grades, setGrades] = useState([]);
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const allTests = [...globalTests, ...schoolTests];
  const selectedTest = allTests.find((test) => test.id === selectedTestId);

  async function saveTest(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        duration_seconds: Number(form.duration_seconds || 300)
      };
      if (editingTestId) {
        await api.patch(`/school-admin/typing/school-tests/${editingTestId}`, payload);
      } else {
        await api.post("/school-admin/typing/school-tests", payload);
      }
      setForm({ title: "", passage: "", duration_seconds: 300, max_attempts: 3, grade_levels: [1] });
      setEditingTestId("");
      setMessage(editingTestId ? "Typing test updated." : "Typing test created.");
      onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function editTest(test) {
    setEditingTestId(test.id);
    setForm({
      title: test.title || "",
      passage: test.passage || "",
      duration_seconds: Number(test.duration_seconds || 300),
      max_attempts: Number(test.max_attempts || 3),
      grade_levels: test.grade_levels?.length ? test.grade_levels : [1]
    });
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingTestId("");
    setForm({ title: "", passage: "", duration_seconds: 300, max_attempts: 3, grade_levels: [1] });
  }

  async function assignTest(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await api.post(`/school-admin/typing/tests/${selectedTestId}/assign`, {
        grades,
        available_from: availableFrom || null,
        available_until: availableUntil || null
      });
      setMessage(`${result.count} typing assignment rows saved.`);
      setGrades([]);
      setSelectedTestId("");
      setAvailableFrom("");
      setAvailableUntil("");
      onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="quiz-school-grid">
      <section className="panel compact-panel">
        <h3>{editingTestId ? "Edit School Typing Test" : "Create School Typing Test"}</h3>
        <form className="school-form" onSubmit={saveTest}>
          <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>Passage<textarea value={form.passage} onChange={(e) => setForm({ ...form, passage: e.target.value })} required /></label>
          <label>Duration seconds<input type="number" min="30" max="1800" value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })} /></label>
          <label>Attempts allowed<input type="number" min="1" max="20" value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: e.target.value })} /></label>
          <GradeChecks value={form.grade_levels} onChange={(gradeLevels) => setForm({ ...form, grade_levels: gradeLevels })} />
          <button type="submit"><Plus size={16} />{editingTestId ? "Save typing test" : "Create typing test"}</button>
          {editingTestId ? <button type="button" className="secondary-button" onClick={cancelEdit}>Cancel edit</button> : null}
        </form>
      </section>
      <section className="panel compact-panel">
        <h3>School Typing Tests</h3>
        <DataTable rows={schoolTests} emptyTitle="No school typing tests yet" columns={[
          { key: "title", label: "Test" },
          { key: "duration_seconds", label: "Seconds" },
          { key: "max_attempts", label: "Attempts" },
          { key: "grade_levels", label: "Grades", render: (row) => row.grade_levels?.join("-") || "-" },
          { key: "action", label: "Action", render: (row) => <button type="button" onClick={() => editTest(row)}>Edit</button> }
        ]} />
      </section>
      <section className="panel compact-panel">
        <h3>Assign Typing Test</h3>
        <form className="school-form" onSubmit={assignTest}>
          <label>Typing test<select value={selectedTestId} onChange={(e) => { setSelectedTestId(e.target.value); setGrades([]); }} required><option value="">Select test</option>{allTests.map((test) => <option key={test.id} value={test.id}>{test.title} {test.is_global ? "(global)" : "(school)"}</option>)}</select></label>
          {selectedTest ? <p className="helper-text">Available to Grade {selectedTest.grade_levels?.join("-")}.</p> : null}
          <GradeChecks value={grades} allowed={selectedTest?.grade_levels} onChange={setGrades} />
          <label>Available from<input type="datetime-local" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} /></label>
          <label>Available until<input type="datetime-local" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} /></label>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}
          <button type="submit"><CheckCircle2 size={16} />Assign typing test</button>
        </form>
      </section>
      <section className="panel compact-panel">
        <h3>Typing Assignments</h3>
        <DataTable rows={assignments} emptyTitle="No typing tests assigned yet" columns={[
          { key: "title", label: "Test" },
          { key: "is_global", label: "Scope", render: (row) => row.is_global ? "Global" : "School" },
          { key: "grade", label: "Grade" },
          { key: "max_attempts", label: "Attempts" },
          { key: "learner_count", label: "Learners" },
          { key: "available_until", label: "Available until", render: (row) => row.available_until ? formatDate(row.available_until) : "Open" }
        ]} />
      </section>
      <section className="panel compact-panel">
        <h3>Typing Performance</h3>
        <DataTable rows={performance} emptyTitle="No typing attempts yet" columns={[
          { key: "test_title", label: "Test", render: (row) => row.test_title || "Untitled test" },
          { key: "attempts", label: "Attempts" },
          { key: "best_wpm", label: "Best WPM", render: (row) => row.best_wpm ? Number(row.best_wpm).toFixed(1) : "-" },
          { key: "average_accuracy", label: "Avg accuracy", render: (row) => row.average_accuracy ? `${Number(row.average_accuracy).toFixed(1)}%` : "-" }
        ]} />
      </section>
    </div>
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

function reportChartSvg(rows, valueKey, title, suffix = "") {
  const data = Array.isArray(rows) ? rows.filter((row) => Number.isFinite(Number(row[valueKey]))) : [];
  if (!data.length) return `<div class="empty-chart">No ${escapeHtml(title.toLowerCase())} trend data recorded.</div>`;
  const width = 320;
  const height = 150;
  const padding = 28;
  const max = Math.max(...data.map((row) => Number(row[valueKey])), valueKey === "score" ? 100 : 10);
  const points = data.map((row, index) => {
    const x = data.length === 1 ? width / 2 : padding + (index * (width - padding * 2)) / (data.length - 1);
    const y = height - padding - (Number(row[valueKey]) / max) * (height - padding * 2);
    return { x, y, value: Number(row[valueKey]), week: row.week || index + 1 };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  return `<svg class="report-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" />
    <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" />
    <path d="${path}" />
    ${points.map((point) => `<g><circle cx="${point.x}" cy="${point.y}" r="4" /><text x="${point.x}" y="${point.y - 8}">${escapeHtml(point.value.toFixed(valueKey === "score" ? 1 : 0))}${escapeHtml(suffix)}</text><text x="${point.x}" y="${height - 8}">W${escapeHtml(point.week)}</text></g>`).join("")}
  </svg>`;
}

function buildReportHtml(detail) {
  const report = detail.report || {};
  const learner = report.learner || detail.learner;
  const term = report.term || detail.selected_term;
  const school = report.school || detail.school || {};
  const logo = school.logo_url ? assetUrl(school.logo_url) : "";
  const courseRows = (report.courses || []).map((course) => `<tr><td>${escapeHtml(course.course_name)}</td><td>${escapeHtml(course.status)}</td><td>${escapeHtml(course.term_name)}</td></tr>`).join("");
  const quizRows = (detail.quiz_results || []).map((quiz) => `<tr><td>${escapeHtml(quiz.quiz_title || "Untitled quiz")}</td><td>${escapeHtml(quiz.score)}</td><td>${escapeHtml(quiz.created_at ? new Date(quiz.created_at).toLocaleDateString() : "")}</td></tr>`).join("");
  const typingRows = (detail.typing_results || []).map((typing) => `<tr><td>${escapeHtml(typing.wpm)}</td><td>${escapeHtml(typing.accuracy)}</td><td>${escapeHtml(typing.created_at ? new Date(typing.created_at).toLocaleDateString() : "")}</td></tr>`).join("");
  const progressRows = (detail.lesson_progress || []).map((item) => `<tr><td>${escapeHtml(item.course_name)}</td><td>${escapeHtml(item.module_name)}</td><td>${escapeHtml(item.lesson_name)}</td><td>${escapeHtml(item.score)}</td><td>${escapeHtml(item.score == null ? "-" : item.score <= 50 ? "APPROACHING" : item.score <= 80 ? "MEETING" : "EXCEEDING")}</td></tr>`).join("");
  const typingWeekly = detail.typing_weekly || [];
  const quizWeekly = detail.quiz_weekly || [];

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(learner.full_name)} Report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #102033; margin: 32px; }
    h1, h2 { margin-bottom: 6px; }
    .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
    .report-logo { width: 72px; height: 72px; object-fit: contain; border: 1px solid #d8e1ef; border-radius: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; }
    th, td { border: 1px solid #d8e1ef; padding: 8px; text-align: left; }
    th { background: #eef4ff; }
    .meta { color: #536172; }
    .overall { display: inline-block; background: #1d5fc4; color: #fff; border-radius: 999px; padding: 5px 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0 24px; }
    .chart-card { border: 1px solid #d8e1ef; border-radius: 10px; padding: 12px; }
    .report-chart { width: 100%; height: auto; }
    .report-chart line { stroke: #c9d5e7; }
    .report-chart path { fill: none; stroke: #003b8f; stroke-width: 2; }
    .report-chart circle { fill: #003b8f; }
    .report-chart text { font-size: 10px; fill: #334155; text-anchor: middle; }
    .empty-chart { color: #667085; font-size: 12px; padding: 36px 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="report-header">
    ${logo ? `<img class="report-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(school.name || "School")} logo" />` : ""}
    <div>
      <h1>${escapeHtml(learner.full_name)}</h1>
      <p class="meta">${escapeHtml(school.name || "")}</p>
      <p class="meta">Username: ${escapeHtml(learner.username)} | Grade ${escapeHtml(learner.grade)}${learner.stream ? ` | ${escapeHtml(learner.stream)}` : ""}</p>
      <p class="meta">Term: ${term ? `${escapeHtml(term.year)} ${escapeHtml(term.name)}` : "No selected term"}</p>
      <p><span class="overall">${escapeHtml(report.overall_performance || "Meets Expectation")}</span></p>
    </div>
  </div>
  <div class="chart-grid">
    <section class="chart-card"><h2>Typing Trend</h2>${reportChartSvg(typingWeekly, "wpm", "Typing trend")}</section>
    <section class="chart-card"><h2>Quiz Trend</h2>${reportChartSvg(quizWeekly, "score", "Quiz trend", "%")}</section>
  </div>
  <h2>Course Report</h2>
  <table><thead><tr><th>Course</th><th>Status</th><th>Term</th></tr></thead><tbody>${courseRows || "<tr><td colspan=\"3\">No course records for this term.</td></tr>"}</tbody></table>
  <h2>Quiz Performance</h2>
  <p>Average score: ${report.quiz_summary?.average_score == null ? "No attempts" : Number(report.quiz_summary.average_score).toFixed(1)}</p>
  <table><thead><tr><th>Quiz</th><th>Score</th><th>Date</th></tr></thead><tbody>${quizRows || "<tr><td colspan=\"3\">No quiz records for this term.</td></tr>"}</tbody></table>
  <h2>Typing Performance</h2>
  <p>Average WPM: ${report.typing_summary?.average_wpm == null ? "No attempts" : Number(report.typing_summary.average_wpm).toFixed(1)} | Average accuracy: ${report.typing_summary?.average_accuracy == null ? "No attempts" : `${Number(report.typing_summary.average_accuracy).toFixed(1)}%`}</p>
  <table><thead><tr><th>WPM</th><th>Accuracy</th><th>Date</th></tr></thead><tbody>${typingRows || "<tr><td colspan=\"3\">No typing records for this term.</td></tr>"}</tbody></table>
  <h2>Lesson Progress</h2>
  <table><thead><tr><th>Course</th><th>Module</th><th>Lesson</th><th>Score</th><th>Performance</th></tr></thead><tbody>${progressRows || "<tr><td colspan=\"5\">No lesson progress yet.</td></tr>"}</tbody></table>
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

function LearnerDetailPanel({ detail, streams, terms, onClose, onSaved, onTermChange, setShowReportCard }) {
  const [form, setForm] = useState({
    full_name: detail.learner.full_name || "",
    grade: detail.learner.grade || "",
    stream: detail.learner.stream || "",
    parent_name: detail.learner.parent_name || "",
    parent_email: detail.learner.parent_email || "",
    parent_phone: detail.learner.parent_phone || "",
    is_active: Boolean(detail.learner.is_active)
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

  async function setActive(active) {
    setError("");
    setMessage("");
    try {
      await api.patch(`/school-admin/learners/${detail.learner.id}/status`, { is_active: active });
      setForm((current) => ({ ...current, is_active: active }));
      setMessage(active ? "Learner account reactivated." : "Learner account deactivated.");
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
          <button type="button" className="secondary-button" onClick={() => exportLearnerReport(detail)}><Download size={16} />Export HTML report</button>
          <button type="button" className="secondary-button" onClick={() => setShowReportCard(true)}><Download size={16} />Print report card</button>
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
        <label className="check-row"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />Learner account active</label>
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
          {detail.learner.is_active ? (
            <button type="button" className="secondary-button" onClick={() => setActive(false)}>Deactivate account</button>
          ) : (
            <button type="button" className="secondary-button" onClick={() => setActive(true)}>Reactivate account</button>
          )}
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
        <section className="panel compact-panel"><h3>Weekly Quiz Trend</h3><QuizTrendChart rows={detail.weekly_quiz_trend} /></section>
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

const SIDEBAR_HIDE_DELAY_MS = 420;

export default function SchoolAdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarOpenRef = useRef(false);
  const hideSidebarTimerRef = useRef(null);
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
    terms: [],
    globalQuizzes: [],
    schoolQuizzes: [],
    quizAssignments: [],
    quizPerformance: [],
    globalTypingTests: [],
    schoolTypingTests: [],
    typingAssignments: [],
    typingPerformance: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [learnerFilters, setLearnerFilters] = useState({ search: "", grade: "", stream: "" });
  const [learnerDetail, setLearnerDetail] = useState(null);
  const [showReportCard, setShowReportCard] = useState(false);
  const [coursesNavOpen, setCoursesNavOpen] = useState(false);

  const activeTermLabel = useMemo(() => {
    const term = state.summary?.active_term;
    return term ? `${term.year} - ${term.name}` : "No active term";
  }, [state.summary]);
  const activeCourse = useMemo(() => state.courses.find((course) => activeTab === `course:${course.id}`), [activeTab, state.courses]);
  const sortedCourses = useMemo(
    () => [...state.courses].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })),
    [state.courses]
  );

  useEffect(() => {
    if (activeTab !== "courses" && !String(activeTab).startsWith("course:")) {
      setCoursesNavOpen(false);
    }
  }, [activeTab]);

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
        terms: api.get("/school-admin/terms"),
        globalQuizzes: api.get("/school-admin/global-quizzes"),
        schoolQuizzes: api.get("/school-admin/school-quizzes"),
        quizAssignments: api.get("/school-admin/quiz-assignments"),
        quizPerformance: api.get("/school-admin/quiz-performance"),
        globalTypingTests: api.get("/school-admin/typing/global-tests"),
        schoolTypingTests: api.get("/school-admin/typing/school-tests"),
        typingAssignments: api.get("/school-admin/typing/assignments"),
        typingPerformance: api.get("/school-admin/typing/performance")
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
        terms: data.terms || [],
        globalQuizzes: data.globalQuizzes || [],
        schoolQuizzes: data.schoolQuizzes || [],
        quizAssignments: data.quizAssignments || [],
        quizPerformance: data.quizPerformance || [],
        globalTypingTests: data.globalTypingTests || [],
        schoolTypingTests: data.schoolTypingTests || [],
        typingAssignments: data.typingAssignments || [],
        typingPerformance: data.typingPerformance || []
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

  async function deallocateCourse(row) {
    const confirmed = window.confirm(`Deallocate ${row.name} from all active learners this term?`);
    if (!confirmed) return;
    setError("");
    setNotice("");
    try {
      const result = await api.delete(`/school-admin/course-allocations/${row.id}`);
      setNotice(`${row.name} deallocated from ${result.count} learner${result.count === 1 ? "" : "s"} for the active term.`);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

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
    <main className={`school-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside
        className="school-sidebar"
        onPointerEnter={onSidebarPointerEnter}
        onPointerLeave={onSidebarPointerLeave}
      >
        <div className="school-brand">
          <Sparkles size={28} />
          <div>
            <strong>EduClub</strong>
            <span>School Admin</span>
          </div>
        </div>
        <button type="button" className="sidebar-toggle" onClick={toggleSidebar} title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}>
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          <span>{sidebarOpen ? "Hide" : "Show"}</span>
        </button>
        <nav>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isCourses = tab.id === "courses";
            const courseSectionActive = isCourses && (activeTab === "courses" || String(activeTab).startsWith("course:"));
            const tabButtonActive = isCourses ? courseSectionActive : activeTab === tab.id;
            return (
              <div key={tab.id} className="nav-group">
                <button
                  type="button"
                  className={tabButtonActive ? "active" : ""}
                  onClick={() => {
                    if (isCourses) {
                      if (courseSectionActive) {
                        setCoursesNavOpen((open) => !open);
                      } else {
                        setActiveTab("courses");
                        setCoursesNavOpen(true);
                      }
                    } else {
                      setActiveTab(tab.id);
                    }
                  }}
                >
                  <Icon size={18} /><span>{tab.label}</span>
                </button>
                {isCourses && sidebarOpen && coursesNavOpen ? (
                  <div className="course-subnav course-subnav-dropdown">
                    {sortedCourses.map((course) => (
                      <button key={course.id} type="button" className={activeTab === `course:${course.id}` ? "active" : ""} onClick={() => setActiveTab(`course:${course.id}`)}>
                        <span>{course.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <button className="logout-button" onClick={logout}><LogOut size={18} /><span>Sign out</span></button>
      </aside>

      <section className="school-main">
        <header className="school-hero">
          <div className="school-hero-title">
            {state.profile?.logo_url ? <img className="school-logo-md" src={assetUrl(state.profile.logo_url)} alt={`${state.profile.school_name} logo`} /> : null}
            <div>
              <p className="eyebrow">Active term: {activeTermLabel}</p>
              <h1>{state.profile?.school_name || "Your school"} learning studio</h1>
              <p>Guide learners, review work, track typing growth, manage streams, and keep report cards moving with quiet confidence.</p>
            </div>
          </div>
          <div className="last-login-card">
            <Bell size={20} />
            <span>Last login</span>
            <strong>{formatDate(user?.previous_login_at || state.profile?.previous_login_at)}</strong>
          </div>
        </header>

        {error ? <div className="alert">{error}</div> : null}
        {notice ? <div className="alert success-alert">{notice}</div> : null}
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
                { key: "enrolment_count", label: "Learners" },
                { key: "action", label: "Action", render: (row) => <button type="button" className="danger-button" onClick={() => deallocateCourse(row)}>Deallocate</button> }
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
            {learnerDetail ? <LearnerDetailPanel detail={learnerDetail} streams={state.streams} terms={state.terms} onClose={() => setLearnerDetail(null)} onSaved={refreshLearnerDetail} onTermChange={openLearnerDetail} setShowReportCard={setShowReportCard} /> : null}
            {showReportCard && (
              <ReportCard
                data={{
                  school: { name: state.profile?.school_name || "School Name", logo_url: state.profile?.logo_url || "" },
                  learner: learnerDetail?.learner || { full_name: "Learner", grade: "", stream: "", member_id: "", attendance: "" },
                  term: learnerDetail?.selected_term || { year: "", name: "" },
                  tutors: { lead: state.profile?.lead_tutor || "Tutor", assistant: state.profile?.assistant_tutor || "Assistant" },
                  overall_performance: learnerDetail?.report?.overall_performance || "Meets Expectation",
                  typing_weekly: learnerDetail?.typing_weekly || [],
                  quiz_weekly: learnerDetail?.quiz_weekly || [],
                  course: learnerDetail?.course || learnerDetail?.report?.course || { name: "Current Course", modules: [] },
                  teacher_feedback: learnerDetail?.report?.teacher_remarks || "No feedback yet.",
                  generated_at: new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })
                }}
                onClose={() => setShowReportCard(false)}
              />
            )}
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

        {!loading && activeTab === "courses" && (
          <section className="panel">
            <h2>Courses</h2>
            <DataTable rows={state.courses} emptyTitle="No courses available yet" columns={[
              { key: "name", label: "Course" },
              { key: "is_coming_soon", label: "Status", render: (row) => row.is_coming_soon ? "Program under development" : "Available" },
              { key: "action", label: "Open", render: (row) => <button type="button" onClick={() => setActiveTab(`course:${row.id}`)}>Open</button> }
            ]} />
          </section>
        )}

        {!loading && activeCourse && (
          <section className="panel">
            <h2>{activeCourse.name}</h2>
            {activeCourse.name === "Web development" ? (
              <div className="module-card-grid">
                {(activeCourse.modules || []).map((module) => (
                  <article className="module-card" key={module.id}>
                    <span>Module {module.sort_order}</span>
                    <h3>{module.name}</h3>
                    <p>{module.objectives}</p>
                    <strong>{module.badge_name} · {module.xp_points} XP</strong>
                  </article>
                ))}
              </div>
            ) : <p className="helper-text">Program under development coming soon.</p>}
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
          <section className="school-section">
            <TypingTestPanel globalTests={state.globalTypingTests} schoolTests={state.schoolTypingTests} assignments={state.typingAssignments} performance={state.typingPerformance} onRefresh={loadDashboard} />
            <section className="panel">
              <h2>Typing Test Results</h2>
              <DataTable rows={state.typing} emptyTitle="No typing results yet" columns={[
                { key: "test_title", label: "Test", render: (row) => row.test_title || "Typing test" },
                { key: "learner_name", label: "Learner" },
                { key: "wpm", label: "WPM" },
                { key: "accuracy", label: "Accuracy", render: (row) => `${Number(row.accuracy || 0).toFixed(1)}%` },
                { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }
              ]} />
            </section>
          </section>
        )}

        {!loading && activeTab === "quizzes" && (
          <section className="school-section">
            <section className="panel">
              <h2>Global Quizzes</h2>
              <DataTable rows={state.globalQuizzes} emptyTitle="No global quizzes published yet" columns={[
                { key: "title", label: "Quiz" },
                { key: "grade_levels", label: "Grades", render: (row) => row.grade_levels?.join(", ") || "-" },
                { key: "question_count", label: "Questions" },
                { key: "max_attempts", label: "Default attempts" }
              ]} />
            </section>
            <QuizAssignmentPanel globalQuizzes={state.globalQuizzes} schoolQuizzes={state.schoolQuizzes} assignments={state.quizAssignments} performance={state.quizPerformance} onRefresh={loadDashboard} />
            <CreateSchoolQuizForm onCreated={loadDashboard} />
            <section className="panel">
              <h2>Quiz Results Overview</h2>
            <DataTable rows={state.quizzes} emptyTitle="No quiz attempts yet" columns={[
              { key: "quiz_title", label: "Quiz", render: (row) => row.quiz_title || "Untitled quiz" },
              { key: "learner_name", label: "Learner" },
              { key: "score", label: "Score" },
              { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }
            ]} />
            </section>
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
