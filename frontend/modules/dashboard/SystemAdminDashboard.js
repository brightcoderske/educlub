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
  Plus,
  Shield,
  Users
} from "lucide-react";
import { api } from "../../lib/api";
import { currentUser, logout } from "../../lib/auth";
import "./dashboard.css";

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

export default function SystemAdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [user, setUser] = useState(null);
  const [data, setData] = useState({
    summary: null,
    schools: [],
    terms: [],
    users: [],
    courses: [],
    questions: [],
    leaderboards: [],
    audit: [],
    performance: []
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
      const [summary, schools, terms, users, courses, questions, leaderboards, audit, performance] = await Promise.all([
        api.get("/analytics/system-admin/summary"),
        api.get("/schools"),
        api.get("/terms"),
        api.get("/users"),
        api.get("/courses"),
        api.get("/quizzes/global-questions"),
        api.get("/leaderboards"),
        api.get("/analytics/audit-logs"),
        api.get("/analytics/system-admin/school-performance")
      ]);
      setData({
        summary,
        schools: schools.data,
        terms: terms.data,
        users: users.data,
        courses: courses.data,
        questions: questions.data,
        leaderboards: leaderboards.data,
        audit: audit.data,
        performance
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            <DataTable rows={data.schools} emptyTitle="No schools yet" columns={[
              { key: "name", label: "School" },
              { key: "contact_email", label: "Email" },
              { key: "clubs", label: "Clubs", render: (row) => row.clubs?.join(", ") || "-" },
              { key: "is_active", label: "Status", render: (row) => row.is_active ? "Active" : "Suspended" }
            ]} />
          </section>
        )}

        {!loading && activeTab === "users" && (
          <section className="panel">
            <h2>User Management</h2>
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
            <CreateQuestionForm onCreated={loadDashboard} />
            <DataTable rows={data.questions} emptyTitle="No global questions yet" columns={[
              { key: "question", label: "Question" },
              { key: "correct_option", label: "Answer" },
              { key: "created_at", label: "Created" }
            ]} />
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
