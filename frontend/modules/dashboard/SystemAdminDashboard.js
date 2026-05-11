"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  GraduationCap,
  Layers,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  Users
} from "lucide-react";
import { api, assetUrl } from "../../lib/api";
import { currentUser, logout } from "../../lib/auth";
import CourseBuilderPanel from "./CourseBuilderPanel";

const SIDEBAR_HIDE_DELAY_MS = 420;

const tabs = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "schools", label: "Schools", icon: Building2 },
  { id: "users", label: "Users", icon: Users },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "course-builder", label: "Course builder", icon: Layers },
  { id: "quiz", label: "Quiz Pool", icon: ClipboardList },
  { id: "leaderboards", label: "Leaderboards", icon: GraduationCap },
  { id: "audit", label: "Audit", icon: Shield }
];

function EmptyState({ title, detail }) {
  return (
    <div className="empty-state">
      <p>{title}</p>
      <span>{detail}</span>
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value ?? "0"}</strong>
      <small>{detail}</small>
    </article>
  );
}

function DataTable({ columns, rows, emptyTitle, wrapClassName }) {
  if (!rows?.length) {
    return <EmptyState title={emptyTitle} detail="No records exist yet. When real data is created, it will appear here." />;
  }
  const rowKey = (row, index) => {
    return row.id || row.school_id || row.user_id || row.learner_id || row.course_id || row.quiz_id || row.created_at || `${row.leaderboard_type || "row"}-${row.rank || index}-${index}`;
  };

  return (
    <div className={`table-wrap${wrapClassName ? ` ${wrapClassName}` : ""}`}>
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

function CreateSchoolForm({ onCreated }) {
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [clubs, setClubs] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const school = await api.post("/schools", {
        name,
        contact_email: contactEmail || null,
        clubs: clubs.split(",").map((club) => club.trim()).filter(Boolean)
      });
      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        await api.upload(`/schools/${school.id}/logo`, formData);
      }
      setName("");
      setContactEmail("");
      setClubs("");
      setLogoFile(null);
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <label>School name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>Contact email<input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></label>
      <label>Clubs<input value={clubs} onChange={(e) => setClubs(e.target.value)} placeholder="Computer, Chess" /></label>
      <label>Logo<input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} /></label>
      <button type="submit" disabled={saving}><Plus size={16} />{saving ? "Saving" : "Add school"}</button>
    </form>
  );
}

function CreateTermForm({ academicYears, onCreated }) {
  const [year, setYear] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [name, setName] = useState("Term 1");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [makeActive, setMakeActive] = useState(true);
  const [error, setError] = useState("");

  async function createYear(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await api.post("/terms/academic-years", { year: Number(year) });
      setSelectedYear(String(result.year));
      setYear("");
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createTerm(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post("/terms", {
        year: Number(selectedYear),
        name,
        starts_on: startsOn,
        ends_on: endsOn,
        make_global_active: makeActive
      });
      setStartsOn("");
      setEndsOn("");
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="split-forms">
      <form className="inline-form" onSubmit={createYear}>
        <label>Academic year<input type="number" value={year} onChange={(e) => setYear(e.target.value)} required /></label>
        <button type="submit"><Plus size={16} />Create year</button>
      </form>
      <form className="inline-form" onSubmit={createTerm}>
        <label>Year
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} required>
            <option value="">Select year</option>
            {academicYears.map((item) => <option key={item.id} value={item.year}>{item.year}</option>)}
          </select>
        </label>
        <label>Term<select value={name} onChange={(e) => setName(e.target.value)}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></label>
        <label>Starts<input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required /></label>
        <label>Ends<input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required /></label>
        <label className="check-row"><input type="checkbox" checked={makeActive} onChange={(e) => setMakeActive(e.target.checked)} />Make active for all schools</label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit"><Plus size={16} />Create term</button>
      </form>
    </div>
  );
}

function CreateCourseForm({ onCreated }) {
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [objectives, setObjectives] = useState("");

  async function submit(event) {
    event.preventDefault();
    await api.post("/courses", { name, club: club || null, objectives: objectives || null });
    setName("");
    setClub("");
    setObjectives("");
    onCreated();
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <label>Course name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>Club<input value={club} onChange={(e) => setClub(e.target.value)} /></label>
      <label>Objectives<textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} /></label>
      <button type="submit"><Plus size={16} />Create course</button>
    </form>
  );
}

function CreateQuestionForm({ onCreated }) {
  const [form, setForm] = useState({ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A" });

  async function submit(event) {
    event.preventDefault();
    await api.post("/quizzes/global-questions", form);
    setForm({ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A" });
    onCreated();
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form className="question-form" onSubmit={submit}>
      <label>Question<textarea value={form.question} onChange={(e) => update("question", e.target.value)} required /></label>
      <div className="option-grid">
        <label>Option A<input value={form.option_a} onChange={(e) => update("option_a", e.target.value)} required /></label>
        <label>Option B<input value={form.option_b} onChange={(e) => update("option_b", e.target.value)} required /></label>
        <label>Option C<input value={form.option_c} onChange={(e) => update("option_c", e.target.value)} required /></label>
        <label>Option D<input value={form.option_d} onChange={(e) => update("option_d", e.target.value)} required /></label>
      </div>
      <label>Correct option<select value={form.correct_option} onChange={(e) => update("correct_option", e.target.value)}><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
      <button type="submit"><Plus size={16} />Add question</button>
    </form>
  );
}

function GradeChecks({ value, onChange }) {
  const grades = value || [];
  function toggle(grade) {
    onChange(grades.includes(grade) ? grades.filter((item) => item !== grade) : [...grades, grade].sort((a, b) => a - b));
  }
  return (
    <div className="grade-checks">
      {Array.from({ length: 9 }, (_, index) => index + 1).map((grade) => (
        <label key={grade} className="check-row">
          <input type="checkbox" checked={grades.includes(grade)} onChange={() => toggle(grade)} />
          Grade {grade}
        </label>
      ))}
    </div>
  );
}

function GlobalQuizForm({ onCreated }) {
  const [form, setForm] = useState({ title: "", description: "", grade_levels: [1], max_attempts: 1, time_limit_seconds: "" });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post("/quizzes/global", {
        ...form,
        max_attempts: Number(form.max_attempts || 1),
        time_limit_seconds: form.time_limit_seconds ? Number(form.time_limit_seconds) : null
      });
      setForm({ title: "", description: "", grade_levels: [1], max_attempts: 1, time_limit_seconds: "" });
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="inline-form quiz-admin-form" onSubmit={submit}>
      <label>Quiz title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
      <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      <label>Max attempts<input type="number" min="1" max="20" value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: e.target.value })} required /></label>
      <label>Time limit seconds<input type="number" min="30" value={form.time_limit_seconds} onChange={(e) => setForm({ ...form, time_limit_seconds: e.target.value })} /></label>
      <GradeChecks value={form.grade_levels} onChange={(grades) => setForm({ ...form, grade_levels: grades })} />
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit"><Plus size={16} />Create global quiz</button>
    </form>
  );
}

function GlobalQuizManager({ quizzes, onChanged }) {
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [question, setQuestion] = useState({ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A" });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function openQuiz(id) {
    setError("");
    setMessage("");
    setSelectedQuiz(await api.get(`/quizzes/global/${id}`));
  }

  async function saveQuiz(event) {
    event.preventDefault();
    setError("");
    try {
      await api.patch(`/quizzes/global/${selectedQuiz.id}`, selectedQuiz);
      setMessage("Quiz updated.");
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteQuiz(id) {
    if (!window.confirm("Delete this global quiz? Existing attempts remain in reports, but the quiz will no longer be assignable.")) return;
    await api.delete(`/quizzes/global/${id}`);
    if (selectedQuiz?.id === id) setSelectedQuiz(null);
    onChanged();
  }

  async function addQuestion(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post(`/quizzes/global/${selectedQuiz.id}/questions`, question);
      setQuestion({ question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A" });
      await openQuiz(selectedQuiz.id);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadQuestions(event) {
    event.preventDefault();
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const result = await api.upload(`/quizzes/global/${selectedQuiz.id}/questions/upload`, formData);
      setMessage(`${result.created.length} questions imported. ${result.errors.length} row errors.`);
      setFile(null);
      await openQuiz(selectedQuiz.id);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="quiz-manager-grid">
      <section className="panel compact-panel">
        <h3>Global Quizzes</h3>
        <DataTable rows={quizzes} emptyTitle="No global quizzes yet" columns={[
          { key: "title", label: "Quiz", render: (row) => <button type="button" className="link-button" onClick={() => openQuiz(row.id)}>{row.title}</button> },
          { key: "grade_levels", label: "Grades", render: (row) => row.grade_levels?.join(", ") || "-" },
          { key: "question_count", label: "Questions" },
          { key: "actions", label: "Actions", render: (row) => <button type="button" className="danger-button compact-action" onClick={() => deleteQuiz(row.id)}><Trash2 size={14} /></button> }
        ]} />
      </section>
      {selectedQuiz ? (
        <section className="panel compact-panel">
          <h3>Manage Quiz</h3>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}
          <form className="stack-form" onSubmit={saveQuiz}>
            <label>Title<input value={selectedQuiz.title || ""} onChange={(e) => setSelectedQuiz({ ...selectedQuiz, title: e.target.value })} required /></label>
            <label>Description<textarea value={selectedQuiz.description || ""} onChange={(e) => setSelectedQuiz({ ...selectedQuiz, description: e.target.value })} /></label>
            <GradeChecks value={selectedQuiz.grade_levels || []} onChange={(grades) => setSelectedQuiz({ ...selectedQuiz, grade_levels: grades })} />
            <label>Max attempts<input type="number" min="1" max="20" value={selectedQuiz.max_attempts || 1} onChange={(e) => setSelectedQuiz({ ...selectedQuiz, max_attempts: Number(e.target.value) })} /></label>
            <button type="submit"><Pencil size={16} />Save quiz</button>
          </form>
          <form className="question-form" onSubmit={addQuestion}>
            <label>Question<textarea value={question.question} onChange={(e) => setQuestion({ ...question, question: e.target.value })} required /></label>
            <div className="option-grid">
              {["option_a", "option_b", "option_c", "option_d"].map((key) => <label key={key}>{key.replace("_", " ").toUpperCase()}<input value={question[key]} onChange={(e) => setQuestion({ ...question, [key]: e.target.value })} required /></label>)}
            </div>
            <label>Correct option<select value={question.correct_option} onChange={(e) => setQuestion({ ...question, correct_option: e.target.value })}><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
            <button type="submit"><Plus size={16} />Add question</button>
          </form>
          <form className="inline-form" onSubmit={uploadQuestions}>
            <label>Bulk questions CSV/XLSX<input type="file" accept=".csv,.xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} required /></label>
            <button type="submit"><Upload size={16} />Upload questions</button>
            <p className="helper-text">Columns: question, option_a, option_b, option_c, option_d, correct_option.</p>
          </form>
          <DataTable rows={selectedQuiz.questions} emptyTitle="No questions yet" columns={[
            { key: "question", label: "Question" },
            { key: "correct_option", label: "Answer" }
          ]} />
        </section>
      ) : null}
    </div>
  );
}

function GlobalTypingForm({ tests, onChanged }) {
  const [form, setForm] = useState({ title: "", passage: "", duration_seconds: 300, max_attempts: 3, grade_levels: [1] });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post("/typing/global", {
        ...form,
        duration_seconds: Number(form.duration_seconds || 300)
      });
      setForm({ title: "", passage: "", duration_seconds: 300, max_attempts: 3, grade_levels: [1] });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel compact-panel">
      <h3>Global Typing Test Pool</h3>
      <form className="stack-form" onSubmit={submit}>
        <label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
        <label>Passage<textarea value={form.passage} onChange={(e) => setForm({ ...form, passage: e.target.value })} required /></label>
        <label>Duration seconds<input type="number" min="30" max="1800" value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })} /></label>
        <label>Attempts allowed<input type="number" min="1" max="20" value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: e.target.value })} /></label>
        <GradeChecks value={form.grade_levels} onChange={(grades) => setForm({ ...form, grade_levels: grades })} />
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit"><Plus size={16} />Create global typing test</button>
      </form>
      <DataTable rows={tests} emptyTitle="No global typing tests yet" columns={[
        { key: "title", label: "Test" },
        { key: "grade_levels", label: "Grades", render: (row) => row.grade_levels?.join(", ") || "-" },
        { key: "duration_seconds", label: "Seconds" },
        { key: "max_attempts", label: "Attempts" },
        { key: "passage_preview", label: "Passage", render: (row) => row.passage_preview || "-" }
      ]} />
    </section>
  );
}

function CreateSchoolAdminForm({ schools, onCreated }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", school_id: "" });
  const [error, setError] = useState("");

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await api.post("/users/school-admins", form);
      setForm({ full_name: "", email: "", password: "", school_id: "" });
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <label>Full name<input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required /></label>
      <label>Email<input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required /></label>
      <label>Temporary password<input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required /></label>
      <label>School<select value={form.school_id} onChange={(e) => update("school_id", e.target.value)} required><option value="">Select school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit"><Plus size={16} />Add School Admin</button>
    </form>
  );
}

function SchoolDetailPanel({ detail, onClose, onChanged }) {
  const [schoolForm, setSchoolForm] = useState({
    name: detail.school.name || "",
    contact_email: detail.school.contact_email || "",
    clubs: detail.school.clubs?.join(", ") || ""
  });
  const [logoFile, setLogoFile] = useState(null);
  const [adminForm, setAdminForm] = useState({ full_name: "", email: "", password: "" });
  const [passwords, setPasswords] = useState({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateSchoolForm(key, value) {
    setSchoolForm((current) => ({ ...current, [key]: value }));
  }

  async function saveSchool(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.patch(`/schools/${detail.school.id}`, {
        name: schoolForm.name,
        contact_email: schoolForm.contact_email || null,
        logo_url: detail.school.logo_url || null,
        clubs: schoolForm.clubs.split(",").map((club) => club.trim()).filter(Boolean)
      });
      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        await api.upload(`/schools/${detail.school.id}/logo`, formData);
        setLogoFile(null);
      }
      setMessage("School details updated.");
      onChanged(detail.school.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addAdmin(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.post("/users/school-admins", { ...adminForm, school_id: detail.school.id });
      setAdminForm({ full_name: "", email: "", password: "" });
      setMessage("School Admin added. Password change is required on first login.");
      onChanged(detail.school.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetPassword(adminId) {
    setError("");
    setMessage("");
    try {
      await api.patch(`/schools/${detail.school.id}/admins/${adminId}/password`, { password: passwords[adminId] });
      setPasswords((current) => ({ ...current, [adminId]: "" }));
      setMessage("School Admin password updated. They must change it on first login.");
      onChanged(detail.school.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function setSchoolActive(active) {
    const confirmed = window.confirm(active ? `Reactivate ${detail.school.name} and restore school-paused accounts?` : `Deactivate ${detail.school.name}? Records stay intact, but school logins will be disabled.`);
    if (!confirmed) return;
    setError("");
    try {
      await api.patch(`/schools/${detail.school.id}/suspension`, { suspended: !active });
      setMessage(active ? "School reactivated." : "School deactivated and related accounts paused.");
      onChanged(detail.school.id);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="school-detail-panel">
      <div className="detail-header">
        <div className="school-title-line">
          {detail.school.logo_url ? <img className="school-logo-sm" src={assetUrl(detail.school.logo_url)} alt={`${detail.school.name} logo`} /> : null}
          <div>
            <p className="eyebrow">School workspace</p>
            <h2>{detail.school.name}</h2>
          <p>{detail.counts.learners} learners · {detail.counts.school_admins} school admins · {detail.counts.enrolments} enrolments</p>
        </div>
        </div>
        <button type="button" className="secondary-button" onClick={onClose}>Close</button>
      </div>

      {message ? <div className="success-note">{message}</div> : null}
      {error ? <div className="alert">{error}</div> : null}

      <form className="inline-form detail-form" onSubmit={saveSchool}>
        <label>School name<input value={schoolForm.name} onChange={(e) => updateSchoolForm("name", e.target.value)} required /></label>
        <label>Contact email<input type="email" value={schoolForm.contact_email} onChange={(e) => updateSchoolForm("contact_email", e.target.value)} /></label>
        <label>Clubs<input value={schoolForm.clubs} onChange={(e) => updateSchoolForm("clubs", e.target.value)} /></label>
        <label>Logo<input type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} /></label>
        <button type="submit">Save school</button>
      </form>

      <div className="detail-grid">
        <section className="panel compact-panel">
          <h3>School Admins</h3>
          <form className="stack-form" onSubmit={addAdmin}>
            <label>Full name<input value={adminForm.full_name} onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })} required /></label>
            <label>Email<input type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} required /></label>
            <label>Temporary password<input type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} required /></label>
            <button type="submit"><Plus size={16} />Add admin</button>
          </form>

          {detail.admins.length ? detail.admins.map((admin) => (
            <div className="admin-row" key={admin.id}>
              <div>
                <strong>{admin.full_name}</strong>
                <span>{admin.email}</span>
                <small>{admin.is_active ? "Active" : admin.status || "Inactive"}</small>
              </div>
              <label>New temporary password<input type="password" value={passwords[admin.id] || ""} onChange={(e) => setPasswords({ ...passwords, [admin.id]: e.target.value })} /></label>
              <button type="button" onClick={() => resetPassword(admin.id)}>Set password</button>
            </div>
          )) : <EmptyState title="No School Admins yet" detail="Add a real admin account for this school." />}
        </section>

        <section className="panel compact-panel">
          <h3>Learners In This School</h3>
          <DataTable rows={detail.learners} emptyTitle="No learners in this school yet" columns={[
            { key: "full_name", label: "Learner" },
            { key: "username", label: "Username" },
            { key: "grade", label: "Grade" },
            { key: "stream", label: "Stream", render: (row) => row.stream || "-" },
            { key: "is_active", label: "Active", render: (row) => row.is_active ? "Yes" : "No" }
          ]} />
        </section>
        <section className="panel compact-panel">
          <h3>Academic Progress</h3>
          <DataTable rows={detail.progress} emptyTitle="No learner progress yet" columns={[
            { key: "full_name", label: "Learner" },
            { key: "grade", label: "Grade" },
            { key: "enrolments", label: "Enrolments" },
            { key: "average_quiz_score", label: "Avg quiz", render: (row) => row.average_quiz_score ? Number(row.average_quiz_score).toFixed(1) : "-" },
            { key: "average_typing_wpm", label: "Avg WPM", render: (row) => row.average_typing_wpm ? Number(row.average_typing_wpm).toFixed(1) : "-" }
          ]} />
        </section>
      </div>

      <div className="danger-zone">
        <div>
          <strong>{detail.school.is_active ? "Deactivate school" : "Reactivate school"}</strong>
          <span>Records stay intact. Deactivation blocks school logins and pauses school accounts until reactivated.</span>
        </div>
        {detail.school.is_active ? (
          <button type="button" className="danger-button" onClick={() => setSchoolActive(false)}>Deactivate school</button>
        ) : (
          <button type="button" onClick={() => setSchoolActive(true)}><RefreshCw size={16} />Reactivate school</button>
        )}
      </div>
    </section>
  );
}

function userMatchesFilters(row, filters) {
  const isActive = Boolean(row.is_active);
  if (filters.role && row.role !== filters.role) return false;
  if (filters.school_id && String(row.school_id || "") !== filters.school_id) return false;
  if (filters.status === "active" && (row.deleted_at || !isActive)) return false;
  if (filters.status === "inactive" && (row.deleted_at || isActive)) return false;
  if (filters.status === "closed" && !row.deleted_at) return false;
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    const hay = [row.full_name, row.email, row.username, row.school_name].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function UserManagementPanel({ users, schools, onChanged }) {
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [userFilters, setUserFilters] = useState({ search: "", role: "", school_id: "", status: "" });

  const filteredUsers = useMemo(() => (users || []).filter((row) => userMatchesFilters(row, userFilters)), [users, userFilters]);

  function openUser(user) {
    setSelected({
      id: user.id,
      full_name: user.full_name || "",
      email: user.email || "",
      school_id: user.school_id || "",
      grade: user.grade || "",
      stream: user.stream || "",
      is_active: Boolean(user.is_active)
    });
    setPassword("");
    setMessage("");
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    try {
      await api.patch(`/users/${selected.id}`, {
        ...selected,
        grade: selected.grade ? Number(selected.grade) : null
      });
      setMessage("User details saved.");
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    setError("");
    try {
      await api.patch(`/users/${selected.id}/password`, { password });
      setPassword("");
      setMessage("Password reset. The user must change it on first login.");
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setActive(active) {
    setError("");
    try {
      if (active) {
        await api.patch(`/users/${selected.id}/reactivate`, {});
      } else {
        await api.patch(`/users/${selected.id}/deactivate`, {});
      }
      setSelected((current) => ({ ...current, is_active: active }));
      setMessage(active ? "User reactivated." : "User deactivated.");
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function closeAccount() {
    if (!window.confirm("Close this account? Past term records stay, but login and current activity stop until reactivated.")) return;
    setError("");
    try {
      await api.delete(`/users/${selected.id}`);
      setSelected((current) => ({ ...current, is_active: false }));
      setMessage("Account closed. It can be reactivated from this user list.");
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="user-management-grid">
      <section className="panel compact-panel">
        <h3>System Users</h3>
        <p className="system-users-count">Showing {filteredUsers.length} of {users?.length ?? 0} users</p>
        <form className="inline-form system-users-filters" onSubmit={(event) => event.preventDefault()}>
          <label>Search<input value={userFilters.search} onChange={(e) => setUserFilters({ ...userFilters, search: e.target.value })} placeholder="Name, email, username, school" /></label>
          <label>Role<select value={userFilters.role} onChange={(e) => setUserFilters({ ...userFilters, role: e.target.value })}><option value="">All roles</option><option value="system_admin">System Admin</option><option value="school_admin">School Admin</option><option value="student">Learner</option></select></label>
          <label>School<select value={userFilters.school_id} onChange={(e) => setUserFilters({ ...userFilters, school_id: e.target.value })}><option value="">All schools</option>{schools.map((school) => <option key={school.id} value={String(school.id)}>{school.name}</option>)}</select></label>
          <label>Status<select value={userFilters.status} onChange={(e) => setUserFilters({ ...userFilters, status: e.target.value })}><option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="closed">Closed</option></select></label>
        </form>
        <DataTable rows={filteredUsers} emptyTitle={users?.length ? "No users match these filters" : "No users yet"} wrapClassName="table-scroll-10" columns={[
          { key: "full_name", label: "Name", render: (row) => <button type="button" className="link-button" onClick={() => openUser(row)}>{row.full_name}</button> },
          { key: "role", label: "Role" },
          { key: "school_name", label: "School", render: (row) => row.school_name || "-" },
          { key: "email", label: "Email", render: (row) => row.email || "-" },
          { key: "username", label: "Username", render: (row) => row.username || "-" },
          { key: "status", label: "Status", render: (row) => row.deleted_at ? "Closed" : row.is_active ? "Active" : row.status || "Inactive" }
        ]} />
      </section>
      {selected ? (
        <section className="panel compact-panel">
          <h3>Edit User</h3>
          {message ? <p className="success-text">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <form className="stack-form" onSubmit={save}>
            <label>Full name<input value={selected.full_name} onChange={(e) => setSelected({ ...selected, full_name: e.target.value })} required /></label>
            <label>Email<input type="email" value={selected.email} onChange={(e) => setSelected({ ...selected, email: e.target.value })} /></label>
            <label>School<select value={selected.school_id} onChange={(e) => setSelected({ ...selected, school_id: e.target.value })}><option value="">No school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
            <label>Grade<input type="number" min="1" max="9" value={selected.grade} onChange={(e) => setSelected({ ...selected, grade: e.target.value })} /></label>
            <label>Stream<input value={selected.stream} onChange={(e) => setSelected({ ...selected, stream: e.target.value })} /></label>
            <label className="check-row"><input type="checkbox" checked={selected.is_active} onChange={(e) => setSelected({ ...selected, is_active: e.target.checked })} />Account active</label>
            <button type="submit"><Pencil size={16} />Save user</button>
          </form>
          <form className="inline-form" onSubmit={resetPassword}>
            <label>Temporary password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <button type="submit"><RefreshCw size={16} />Reset password</button>
          </form>
          <div className="user-action-row">
            {selected.is_active ? (
              <button type="button" className="secondary-button" onClick={() => setActive(false)}>Deactivate</button>
            ) : (
              <button type="button" onClick={() => setActive(true)}>Reactivate</button>
            )}
            <button type="button" className="danger-button" onClick={closeAccount}>Close account</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AuditPanel({ initialRows, schools }) {
  const [rows, setRows] = useState(initialRows || []);
  const [filters, setFilters] = useState({ action: "", actor_role: "", school_id: "", sort: "created_at", direction: "desc" });
  const [error, setError] = useState("");

  useEffect(() => {
    setRows(initialRows || []);
  }, [initialRows]);

  async function apply(event) {
    event.preventDefault();
    setError("");
    const params = new URLSearchParams({ pageSize: "30", sort: filters.sort, direction: filters.direction });
    if (filters.action) params.set("action", filters.action);
    if (filters.actor_role) params.set("actor_role", filters.actor_role);
    if (filters.school_id) params.set("school_id", filters.school_id);
    try {
      const result = await api.get(`/analytics/audit-logs?${params.toString()}`);
      setRows(result.data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="audit-panel">
      <form className="inline-form" onSubmit={apply}>
        <label>Action contains<input value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} placeholder="login, learner, school" /></label>
        <label>Actor role<select value={filters.actor_role} onChange={(e) => setFilters({ ...filters, actor_role: e.target.value })}><option value="">All roles</option><option value="system_admin">System Admin</option><option value="school_admin">School Admin</option><option value="student">Learner</option></select></label>
        <label>School<select value={filters.school_id} onChange={(e) => setFilters({ ...filters, school_id: e.target.value })}><option value="">All schools</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
        <label>Sort<select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="created_at">Time</option><option value="action">Action</option><option value="actor_role">Actor role</option><option value="target_type">Target</option></select></label>
        <label>Order<select value={filters.direction} onChange={(e) => setFilters({ ...filters, direction: e.target.value })}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></label>
        <button type="submit">Apply</button>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
      <DataTable rows={rows} emptyTitle="No audit events yet" columns={[
        { key: "created_at", label: "Time", render: (row) => row.created_at ? new Date(row.created_at).toLocaleString() : "-" },
        { key: "actor_name", label: "Actor", render: (row) => row.actor_name || row.actor_role || "-" },
        { key: "action", label: "Action" },
        { key: "target_type", label: "Target", render: (row) => row.target_type || "-" },
        { key: "school_name", label: "School", render: (row) => row.school_name || "-" },
        { key: "term_name", label: "Term", render: (row) => row.term_name ? `${row.year} ${row.term_name}` : "-" }
      ]} />
    </div>
  );
}

export default function SystemAdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarOpenRef = useRef(false);
  const hideSidebarTimerRef = useRef(null);
  const [user, setUser] = useState(null);
  const [data, setData] = useState({
    summary: null,
    schools: [],
    academicYears: [],
    terms: [],
    users: [],
    courses: [],
    globalQuizzes: [],
    questions: [],
    globalTypingTests: [],
    leaderboards: [],
    audit: [],
    performance: []
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolDetail, setSchoolDetail] = useState(null);
  const [coursesNavOpen, setCoursesNavOpen] = useState(false);

  const metricCards = useMemo(() => {
    const totals = data.summary?.totals || {};
    return [
      ["Schools", totals.schools, "All active school accounts"],
      ["Learners", totals.learners, "All learner accounts"],
      ["Courses", totals.courses, "Global course catalogue"],
      ["Pending submissions", totals.pending_submissions, "Awaiting teacher review"]
    ];
  }, [data.summary]);
  const activeCourse = useMemo(() => data.courses.find((course) => activeTab === `course:${course.id}`), [activeTab, data.courses]);
  const sortedCourses = useMemo(
    () => [...data.courses].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })),
    [data.courses]
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
        summary: api.get("/analytics/system-admin/summary"),
        schools: api.get("/schools"),
        academicYears: api.get("/terms/academic-years"),
        terms: api.get("/terms"),
        users: api.get("/users"),
        courses: api.get("/courses"),
        globalQuizzes: api.get("/quizzes/global"),
        questions: api.get("/quizzes/global-questions"),
        globalTypingTests: api.get("/typing/global"),
        leaderboards: api.get("/leaderboards"),
        audit: api.get("/analytics/audit-logs?pageSize=30"),
        performance: api.get("/analytics/system-admin/school-performance")
      };
      const entries = await Promise.all(Object.entries(requests).map(async ([key, promise]) => {
        try {
          return [key, await promise, null];
        } catch (err) {
          return [key, null, err.message];
        }
      }));
      const loaded = Object.fromEntries(entries.map(([key, value]) => [key, value]));
      const failures = entries.filter(([, , failure]) => failure);
      if (failures.length) {
        setError(failures.map(([key, , failure]) => `${key}: ${failure}`).join(" | "));
      }
      setData({
        summary: loaded.summary,
        schools: loaded.schools?.data || [],
        academicYears: loaded.academicYears || [],
        terms: loaded.terms?.data || [],
        users: loaded.users?.data || [],
        courses: loaded.courses?.data || [],
        globalQuizzes: loaded.globalQuizzes?.data || [],
        questions: loaded.questions?.data || [],
        globalTypingTests: loaded.globalTypingTests?.data || [],
        leaderboards: loaded.leaderboards?.data || [],
        audit: loaded.audit?.data || [],
        performance: loaded.performance || []
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openSchool(schoolId) {
    setSelectedSchool(schoolId);
    setError("");
    try {
      const detail = await api.get(`/schools/${schoolId}`);
      setSchoolDetail(detail);
    } catch (err) {
      setError(err.message);
    }
  }

  async function refreshSchoolDetail(schoolId) {
    await loadDashboard();
    if (schoolId) {
      const detail = await api.get(`/schools/${schoolId}`);
      setSchoolDetail(detail);
    } else {
      setSelectedSchool(null);
      setSchoolDetail(null);
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
    if (!sessionUser) {
      window.location.href = "/login";
      return;
    }
    if (sessionUser.role !== "system_admin") {
      window.location.href = "/login";
      return;
    }
    setUser(sessionUser);
    const schoolId = new URLSearchParams(window.location.search).get("school");
    loadDashboard().then(() => {
      if (schoolId) {
        setActiveTab("schools");
        openSchool(schoolId);
      }
    });
  }, []);

  return (
    <main className={`admin-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="admin-sidebar" onPointerEnter={onSidebarPointerEnter} onPointerLeave={onSidebarPointerLeave}>
        <div className="brand-block">
          <BarChart3 size={28} />
          <div>
            <strong>EduClub</strong>
            <span>System Admin</span>
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

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Cross-school command centre</p>
            <h1>Good learning needs good visibility.</h1>
            <p className="header-copy">Manage schools, terms, courses, question pools, reports, and performance from one calm control room.</p>
          </div>
          <div className="user-pill">{user?.full_name || "System Admin"}</div>
        </header>

        {error ? <div className="alert">{error}</div> : null}
        {loading ? <div className="loading-block">Loading live system data...</div> : null}

        {!loading && activeTab === "overview" && (
          <div className="dashboard-section">
            <div className="metric-grid">
              {metricCards.map(([label, value, detail]) => <MetricCard key={label} label={label} value={value} detail={detail} />)}
            </div>
            <section className="panel">
              <h2>School Performance Grid</h2>
              <DataTable
                rows={data.performance}
                emptyTitle="No school performance data yet"
                columns={[
                  { key: "school_name", label: "School" },
                  { key: "enrolment_count", label: "Enrolments" },
                  { key: "average_quiz_score", label: "Avg quiz", render: (row) => row.average_quiz_score ? Number(row.average_quiz_score).toFixed(1) : "-" },
                  { key: "average_typing_wpm", label: "Avg WPM", render: (row) => row.average_typing_wpm ? Number(row.average_typing_wpm).toFixed(1) : "-" },
                  { key: "completion_count", label: "Completed" }
                ]}
              />
            </section>
          </div>
        )}

        {!loading && activeTab === "calendar" && (
          <section className="panel">
            <h2>Academic Calendar Management</h2>
            <CreateTermForm academicYears={data.academicYears} onCreated={loadDashboard} />
            <DataTable rows={data.terms} emptyTitle="No academic terms yet" columns={[
              { key: "name", label: "Term" },
              { key: "year", label: "Year" },
              { key: "starts_on", label: "Starts" },
              { key: "ends_on", label: "Ends" },
              { key: "is_global_active", label: "Global active", render: (row) => row.is_global_active ? "Yes" : <button type="button" className="compact-action" onClick={async () => { await api.patch(`/terms/${row.id}/global-active`, {}); loadDashboard(); }}>Activate</button> }
            ]} />
          </section>
        )}

        {!loading && activeTab === "schools" && (
          <section className="panel">
            <h2>School Management</h2>
            <CreateSchoolForm onCreated={loadDashboard} />
            <DataTable rows={data.schools} emptyTitle="No schools yet" columns={[
              { key: "name", label: "School", render: (row) => <a className="school-name-link" href={`/admin?school=${row.id}`} target="_blank" rel="noreferrer">{row.name} <ExternalLink size={13} /></a> },
              { key: "contact_email", label: "Contact", render: (row) => row.contact_email || "-" },
              { key: "learner_count", label: "Learners" },
              { key: "admin_count", label: "Admins" },
              { key: "is_active", label: "Status", render: (row) => row.is_active ? "Active" : "Inactive" },
              { key: "manage", label: "This tab", render: (row) => <button type="button" className={selectedSchool === row.id ? "compact-action active" : "compact-action"} onClick={() => openSchool(row.id)}>Open</button> }
            ]} />
            {schoolDetail ? <SchoolDetailPanel detail={schoolDetail} onClose={() => { setSelectedSchool(null); setSchoolDetail(null); }} onChanged={refreshSchoolDetail} /> : null}
          </section>
        )}

        {!loading && activeTab === "users" && (
          <section className="panel">
            <h2>User Management</h2>
            <CreateSchoolAdminForm schools={data.schools} onCreated={loadDashboard} />
            <UserManagementPanel users={data.users} schools={data.schools} onChanged={loadDashboard} />
          </section>
        )}

        {!loading && activeTab === "courses" && (
          <section className="panel">
            <h2>Course Publishing Controls</h2>
            <CreateCourseForm onCreated={loadDashboard} />
            <DataTable rows={data.courses} emptyTitle="No courses yet" columns={[
              { key: "name", label: "Course" },
              { key: "club", label: "Club" },
              { key: "is_published", label: "Published", render: (row) => row.is_published ? "Yes" : "No" },
              { key: "published_at", label: "Published at", render: (row) => row.published_at || "-" }
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

        {!loading && activeTab === "quiz" && (
          <section className="dashboard-section">
            <section className="panel">
              <h2>Global Quiz Pool</h2>
              <GlobalQuizForm onCreated={loadDashboard} />
              <GlobalQuizManager quizzes={data.globalQuizzes} onChanged={loadDashboard} />
            </section>
            <GlobalTypingForm tests={data.globalTypingTests} onChanged={loadDashboard} />
          </section>
        )}

        {!loading && activeTab === "leaderboards" && (
          <section className="panel">
            <h2>Leaderboard Viewer</h2>
            <DataTable rows={data.leaderboards} emptyTitle="No leaderboard entries yet" columns={[
              { key: "leaderboard_type", label: "Type" },
              { key: "rank", label: "Rank" },
              { key: "score", label: "Score" },
              { key: "school", label: "School", render: (row) => row.schools?.name || "-" }
            ]} />
          </section>
        )}

        {!loading && activeTab === "course-builder" && (
          <section className="dashboard-section">
            <section className="panel">
              <h2>Drag-and-Drop Course Builder</h2>
              <p className="header-copy" style={{ marginBottom: 16 }}>
                Pick a seeded catalogue course, then shape modules, lessons, and reusable activity blocks. Aim for 100 marks per lesson across activities.
                Grading bands: 0–50 approaching expectations, 51–80 meets expectations, 81–100 exceeds expectations.
              </p>
              <CourseBuilderPanel courses={data.courses} onPublished={loadDashboard} />
            </section>
          </section>
        )}

        {!loading && activeTab === "audit" && (
          <section className="panel">
            <h2>Audit Log Viewer</h2>
            <AuditPanel initialRows={data.audit} schools={data.schools} />
          </section>
        )}
      </section>
    </main>
  );
}
