"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LogOut,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Upload,
  Users
} from "lucide-react";
import { api } from "../../lib/api";
import { currentUser, logout } from "../../lib/auth";

const tabs = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "schools", label: "Schools", icon: Building2 },
  { id: "users", label: "Users", icon: Users },
  { id: "courses", label: "Courses", icon: BookOpen },
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

function DataTable({ columns, rows, emptyTitle }) {
  if (!rows?.length) {
    return <EmptyState title={emptyTitle} detail="No records exist yet. When real data is created, it will appear here." />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || `${row.school_id}-${row.leaderboard_type}`}>
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
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    await api.post("/schools", {
      name,
      contact_email: contactEmail || null,
      clubs: clubs.split(",").map((club) => club.trim()).filter(Boolean)
    });
    setName("");
    setContactEmail("");
    setClubs("");
    setSaving(false);
    onCreated();
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <label>School name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>Contact email<input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></label>
      <label>Clubs<input value={clubs} onChange={(e) => setClubs(e.target.value)} placeholder="Computer, Chess" /></label>
      <button type="submit" disabled={saving}><Plus size={16} />{saving ? "Saving" : "Add school"}</button>
    </form>
  );
}

function CreateTermForm({ onCreated }) {
  const [year, setYear] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [name, setName] = useState("Term 1");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");

  async function createYear(event) {
    event.preventDefault();
    const result = await api.post("/terms/academic-years", { year: Number(year) });
    setAcademicYearId(result.id);
    setYear("");
    onCreated();
  }

  async function createTerm(event) {
    event.preventDefault();
    await api.post("/terms", { academic_year_id: academicYearId, name, starts_on: startsOn, ends_on: endsOn });
    setStartsOn("");
    setEndsOn("");
    onCreated();
  }

  return (
    <div className="split-forms">
      <form className="inline-form" onSubmit={createYear}>
        <label>Academic year<input type="number" value={year} onChange={(e) => setYear(e.target.value)} required /></label>
        <button type="submit"><Plus size={16} />Create year</button>
      </form>
      <form className="inline-form" onSubmit={createTerm}>
        <label>Year ID<input value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} required /></label>
        <label>Term<select value={name} onChange={(e) => setName(e.target.value)}><option>Term 1</option><option>Term 2</option><option>Term 3</option></select></label>
        <label>Starts<input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required /></label>
        <label>Ends<input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required /></label>
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

  async function deleteSchool() {
    const confirmed = window.confirm(`Delete ${detail.school.name}? This permanently removes school-linked users, learners, submissions, reports, preferences, streams, and enrolments. Global academic term definitions remain.`);
    if (!confirmed) return;
    setError("");
    try {
      await api.delete(`/schools/${detail.school.id}`);
      onClose();
      onChanged(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="school-detail-panel">
      <div className="detail-header">
        <div>
          <p className="eyebrow">School workspace</p>
          <h2>{detail.school.name}</h2>
          <p>{detail.counts.learners} learners · {detail.counts.school_admins} school admins · {detail.counts.enrolments} enrolments</p>
        </div>
        <button type="button" className="secondary-button" onClick={onClose}>Close</button>
      </div>

      {message ? <div className="success-note">{message}</div> : null}
      {error ? <div className="alert">{error}</div> : null}

      <form className="inline-form detail-form" onSubmit={saveSchool}>
        <label>School name<input value={schoolForm.name} onChange={(e) => updateSchoolForm("name", e.target.value)} required /></label>
        <label>Contact email<input type="email" value={schoolForm.contact_email} onChange={(e) => updateSchoolForm("contact_email", e.target.value)} /></label>
        <label>Clubs<input value={schoolForm.clubs} onChange={(e) => updateSchoolForm("clubs", e.target.value)} /></label>
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
            { key: "stream", label: "Stream", render: (row) => row.stream || "-" }
          ]} />
        </section>
      </div>

      <div className="danger-zone">
        <div>
          <strong>Delete school</strong>
          <span>Removes school-linked operational data and accounts. Academic year and term definitions are preserved.</span>
        </div>
        <button type="button" className="danger-button" onClick={deleteSchool}>Delete school</button>
      </div>
    </section>
  );
}

export default function SystemAdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [user, setUser] = useState(null);
  const [data, setData] = useState({
    summary: null,
    schools: [],
    terms: [],
    users: [],
    courses: [],
    globalQuizzes: [],
    questions: [],
    leaderboards: [],
    audit: [],
    performance: []
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolDetail, setSchoolDetail] = useState(null);

  const metricCards = useMemo(() => {
    const totals = data.summary?.totals || {};
    return [
      ["Schools", totals.schools, "All active school accounts"],
      ["Learners", totals.learners, "All learner accounts"],
      ["Courses", totals.courses, "Global course catalogue"],
      ["Pending submissions", totals.pending_submissions, "Awaiting teacher review"]
    ];
  }, [data.summary]);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const requests = {
        summary: api.get("/analytics/system-admin/summary"),
        schools: api.get("/schools"),
        terms: api.get("/terms"),
        users: api.get("/users"),
        courses: api.get("/courses"),
        globalQuizzes: api.get("/quizzes/global"),
        questions: api.get("/quizzes/global-questions"),
        leaderboards: api.get("/leaderboards"),
        audit: api.get("/analytics/audit-logs"),
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
        terms: loaded.terms?.data || [],
        users: loaded.users?.data || [],
        courses: loaded.courses?.data || [],
        globalQuizzes: loaded.globalQuizzes?.data || [],
        questions: loaded.questions?.data || [],
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
    loadDashboard();
  }, []);

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand-block">
          <BarChart3 size={28} />
          <div>
            <strong>EduClub</strong>
            <span>System Admin</span>
          </div>
        </div>
        <nav>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
                <Icon size={18} /> {tab.label}
              </button>
            );
          })}
        </nav>
        <button className="logout-button" onClick={logout}><LogOut size={18} /> Sign out</button>
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
            <CreateTermForm onCreated={loadDashboard} />
            <DataTable rows={data.terms} emptyTitle="No academic terms yet" columns={[
              { key: "name", label: "Term" },
              { key: "starts_on", label: "Starts" },
              { key: "ends_on", label: "Ends" },
              { key: "is_global_active", label: "Global active", render: (row) => row.is_global_active ? "Yes" : "No" }
            ]} />
          </section>
        )}

        {!loading && activeTab === "schools" && (
          <section className="panel">
            <h2>School Management</h2>
            <CreateSchoolForm onCreated={loadDashboard} />
            <div className="school-list-grid">
              {data.schools.length ? data.schools.map((school) => (
                <button type="button" className={`school-list-card ${selectedSchool === school.id ? "active" : ""}`} key={school.id} onClick={() => openSchool(school.id)}>
                  <strong>{school.name}</strong>
                  <span>{school.contact_email || "No contact email"}</span>
                  <small>{school.clubs?.join(", ") || "No clubs assigned"}</small>
                </button>
              )) : <EmptyState title="No schools yet" detail="Create a real school to manage its admins and learners." />}
            </div>
            {schoolDetail ? <SchoolDetailPanel detail={schoolDetail} onClose={() => { setSelectedSchool(null); setSchoolDetail(null); }} onChanged={refreshSchoolDetail} /> : null}
          </section>
        )}

        {!loading && activeTab === "users" && (
          <section className="panel">
            <h2>User Management</h2>
            <CreateSchoolAdminForm schools={data.schools} onCreated={loadDashboard} />
            <DataTable rows={data.users} emptyTitle="No users yet" columns={[
              { key: "full_name", label: "Name" },
              { key: "role", label: "Role" },
              { key: "email", label: "Email" },
              { key: "username", label: "Username" },
              { key: "is_active", label: "Active", render: (row) => row.is_active ? "Yes" : "No" }
            ]} />
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

        {!loading && activeTab === "quiz" && (
          <section className="panel">
            <h2>Global Quiz Pool</h2>
            <GlobalQuizForm onCreated={loadDashboard} />
            <GlobalQuizManager quizzes={data.globalQuizzes} onChanged={loadDashboard} />
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

        {!loading && activeTab === "audit" && (
          <section className="panel">
            <h2>Audit Log Viewer</h2>
            <DataTable rows={data.audit} emptyTitle="No audit events yet" columns={[
              { key: "created_at", label: "Time" },
              { key: "actor_role", label: "Actor role" },
              { key: "action", label: "Action" },
              { key: "target_type", label: "Target" }
            ]} />
          </section>
        )}
      </section>
    </main>
  );
}
