"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  BookOpen,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Medal,
  Target,
  Trophy
} from "lucide-react";
import { api } from "../../lib/api";
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

function DataTable({ rows, columns, emptyTitle }) {
  if (!rows?.length) return <EmptyState title={emptyTitle} />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row.course_id || `${row.leaderboard_type}-${row.rank}`}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StudentPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [user, setUser] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeTermLabel = useMemo(() => {
    const term = dashboard?.active_term;
    return term ? `${term.year} - ${term.name}` : "No active term";
  }, [dashboard]);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      setDashboard(await api.get("/student/dashboard"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const sessionUser = currentUser();
    if (!sessionUser || sessionUser.role !== "student") {
      window.location.href = "/login";
      return;
    }
    setUser(sessionUser);
    loadDashboard();
  }, []);

  const summary = dashboard?.summary || {};

  return (
    <main className="student-shell">
      <aside className="student-sidebar">
        <div className="student-brand">
          <Trophy size={28} />
          <div>
            <strong>EduClub</strong>
            <span>Learner</span>
          </div>
        </div>
        <nav>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}><Icon size={18} />{tab.label}</button>;
          })}
        </nav>
        <button className="student-logout" onClick={logout}><LogOut size={18} />Sign out</button>
      </aside>

      <section className="student-main">
        <header className="student-hero">
          <div>
            <p className="eyebrow">{dashboard?.learner?.school_name || "Your school"} - {activeTermLabel}</p>
            <h1>Hi, {dashboard?.learner?.full_name || user?.full_name || "learner"}</h1>
            <p>Track your courses, typing growth, quizzes, badges, and reports from one bright learning space.</p>
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
          </div>
        )}

        {!loading && dashboard && activeTab === "courses" && (
          <section className="student-panel">
            <h2>My Courses</h2>
            <DataTable rows={dashboard.courses} emptyTitle="No enrolled courses for this term." columns={[
              { key: "course_name", label: "Course" },
              { key: "club", label: "Club", render: (row) => row.club || "-" },
              { key: "status", label: "Status" },
              { key: "term_name", label: "Term" }
            ]} />
          </section>
        )}

        {!loading && dashboard && activeTab === "reports" && (
          <section className="student-panel">
            <h2>Reports</h2>
            <DataTable rows={dashboard.reports} emptyTitle="No report cards published yet." columns={[
              { key: "term_name", label: "Term" },
              { key: "year", label: "Year" },
              { key: "teacher_remarks", label: "Remarks", render: (row) => row.teacher_remarks || "-" },
              { key: "published_at", label: "Published", render: (row) => row.published_at ? formatDate(row.published_at) : "-" }
            ]} />
          </section>
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
          <section className="student-panel">
            <h2>Typing Results</h2>
            <DataTable rows={dashboard.typing_results} emptyTitle="No typing results for this term." columns={[
              { key: "wpm", label: "WPM" },
              { key: "accuracy", label: "Accuracy", render: (row) => numberLabel(row.accuracy, "%") },
              { key: "time_taken_seconds", label: "Time" },
              { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }
            ]} />
          </section>
        )}

        {!loading && dashboard && activeTab === "quizzes" && (
          <section className="student-panel">
            <h2>Quiz Results</h2>
            <DataTable rows={dashboard.quiz_results} emptyTitle="No quiz attempts for this term." columns={[
              { key: "quiz_title", label: "Quiz", render: (row) => row.quiz_title || "Untitled quiz" },
              { key: "score", label: "Score" },
              { key: "time_taken_seconds", label: "Time" },
              { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) }
            ]} />
          </section>
        )}
      </section>
    </main>
  );
}
