"use client";

import { useRef } from "react";

const sampleData = {
  school: { name: "ST. MARY'S ACADEMY", logo_url: "" },
  learner: { full_name: "Ryan Maina", grade: "4", stream: "Wisdom", member_id: "STU-2025-0042", attendance: "95%" },
  term: { year: "2025", name: "Term 1" },
  tutors: { lead: "Faith Maundu", assistant: "Peter Kamau" },
  overall_performance: "Exceeds Expectation",
  typing_weekly: [
    { week: 1, wpm: 25 },
    { week: 2, wpm: 32 },
    { week: 3, wpm: 38 },
    { week: 4, wpm: 42 },
    { week: 5, wpm: 48 },
    { week: 6, wpm: 52 }
  ],
  quiz_weekly: [
    { week: 1, score: 60 },
    { week: 2, score: 70 },
    { week: 3, score: 75 },
    { week: 4, score: 82 },
    { week: 5, score: 88 },
    { week: 6, score: 92 }
  ],
  course: {
    name: "Web Development",
    modules: [
      { name: "Introduction to HTML", description: "Learn the structure of web pages using HTML elements.", performance: "EXCEEDING" },
      { name: "CSS Fundamentals", description: "Style web pages using CSS including colors, fonts and layout.", performance: "EXCEEDING" },
      { name: "Responsive Design", description: "Create mobile-friendly websites using media queries and flexbox.", performance: "MEETING" },
      { name: "JavaScript Basics", description: "Add interactivity to websites with variables, events and functions.", performance: "MEETING" },
      { name: "DOM Manipulation", description: "Change page content and styles using JavaScript and the DOM.", performance: "APPROACHING" },
      { name: "Mini Project", description: "Build a personal portfolio website.", performance: "MEETING" }
    ]
  },
  teacher_feedback: "Hi RYAN MAINA, Outstanding effort in topics like Introduction, Headings and Images — you're going above and beyond! Your tutor Faith Maundu is proud of your progress — keep coding and enjoy the journey!",
  generated_at: new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })
};

function PerformanceBadge({ label }) {
  const colors = {
    EXCEEDING: { bg: "#07883f", text: "#fff" },
    MEETING: { bg: "#1d5fc4", text: "#fff" },
    APPROACHING: { bg: "#f4a000", text: "#fff" }
  };
  const style = colors[label] || { bg: "#6b7280", text: "#fff" };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: 600,
      backgroundColor: style.bg,
      color: style.text,
      textTransform: "uppercase",
      letterSpacing: "0.5px"
    }}>
      {label}
    </span>
  );
}

function OverallBadge({ label }) {
  const colors = {
    "Exceeds Expectation": { bg: "#07883f", text: "#fff" },
    "Meets Expectation": { bg: "#1d5fc4", text: "#fff" },
    "Approaching Expectation": { bg: "#f4a000", text: "#fff" }
  };
  const style = colors[label] || { bg: "#6b7280", text: "#fff" };
  return (
    <span style={{
      display: "inline-block",
      padding: "4px 14px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: 700,
      backgroundColor: style.bg,
      color: style.text,
      textTransform: "uppercase",
      letterSpacing: "0.5px"
    }}>
      {label}
    </span>
  );
}

function LineChart({ data, valueKey, label, yLabel, note }) {
  const width = 280;
  const height = 160;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const maxVal = Math.max(...data.map(d => d[valueKey]), 100);
  const minVal = 0;
  const range = maxVal - minVal || 1;
  const xStep = (width - padding.left - padding.right) / (data.length - 1 || 1);

  const points = data.map((d, i) => {
    const x = padding.left + i * xStep;
    const y = padding.top + (height - padding.top - padding.bottom) * (1 - (d[valueKey] - minVal) / range);
    return { x, y, value: d[valueKey], week: d.week };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div style={{ marginTop: "8px" }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", maxHeight: "180px" }}>
        {/* Y axis line */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#ccc" strokeWidth="1" />
        {/* X axis line */}
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#ccc" strokeWidth="1" />
        {/* Y axis label */}
        <text x="12" y={height / 2} textAnchor="middle" transform={`rotate(-90 12 ${height / 2})`} style={{ fontSize: "10px", fill: "#666" }}>{yLabel}</text>
        {/* Line */}
        <path d={linePath} fill="none" stroke="#003b8f" strokeWidth="2" />
        {/* Points and labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#003b8f" stroke="#fff" strokeWidth="2" />
            <text x={p.x} y={p.y - 10} textAnchor="middle" style={{ fontSize: "10px", fontWeight: 600, fill: "#003b8f" }}>{p.value}</text>
          </g>
        ))}
        {/* X axis labels */}
        {data.map((d, i) => (
          <text key={i} x={padding.left + i * xStep} y={height - padding.bottom + 16} textAnchor="middle" style={{ fontSize: "9px", fill: "#666" }}>Week {d.week}</text>
        ))}
      </svg>
      {note && <p style={{ fontSize: "10px", color: "#888", marginTop: "4px", fontStyle: "italic" }}>{note}</p>}
    </div>
  );
}

export default function ReportCard({ data = sampleData, onClose }) {
  const cardRef = useRef(null);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const content = cardRef.current?.innerHTML || "";
    printWindow.document.write(`
      <html>
        <head>
          <title>Report Card - ${data.learner.full_name}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #fff; color: #1a1a2e; }
            .report-card { max-width: 210mm; margin: 0 auto; padding: 20px; }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
            .header-left { display: flex; align-items: center; gap: 12px; }
            .school-logo { width: 60px; height: 60px; object-fit: contain; border-radius: 8px; border: 1px solid #d0d8e8; }
            .header-center { text-align: center; flex: 1; }
            .header-center h1 { font-size: 22px; font-weight: 800; color: #003b8f; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
            .header-center .club { font-size: 13px; color: #003b8f; font-weight: 600; margin: 2px 0; }
            .header-center .term { font-size: 12px; color: #555; margin: 0; }
            .header-right { text-align: right; }
            .header-right .educlub-logo { font-size: 18px; font-weight: 800; color: #003b8f; }
            .header-right .tagline { font-size: 10px; color: #888; }
            .divider { border: none; border-top: 2px dashed #003b8f; margin: 12px 0; }
            .student-card { border: 1px solid #d0d8e8; border-radius: 12px; padding: 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            .student-details { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; flex: 1; }
            .student-details .label { font-size: 11px; color: #888; font-weight: 500; }
            .student-details .value { font-size: 13px; color: #1a1a2e; font-weight: 600; }
            .student-avatar { text-align: center; min-width: 100px; }
            .student-avatar .avatar-circle { width: 60px; height: 60px; border-radius: 50%; background: #003b8f; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; margin: 0 auto 8px; }
            .student-avatar .name { font-size: 14px; font-weight: 700; color: #003b8f; text-transform: uppercase; }
            .student-avatar .class { font-size: 11px; color: #666; }
            .charts-row { display: flex; gap: 16px; margin-bottom: 16px; }
            .chart-card { flex: 1; border: 1px solid #d0d8e8; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            .chart-header { background: linear-gradient(135deg, #002b72, #003b8f); color: #fff; padding: 10px 14px; display: flex; align-items: center; gap: 8px; }
            .chart-header .icon { font-size: 18px; }
            .chart-header .title { font-size: 13px; font-weight: 700; }
            .chart-header .subtitle { font-size: 10px; opacity: 0.8; }
            .chart-body { padding: 10px; }
            .course-card { border: 1px solid #d0d8e8; border-radius: 12px; overflow: hidden; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            .course-header { background: linear-gradient(135deg, #002b72, #003b8f); color: #fff; padding: 10px 14px; display: flex; align-items: center; gap: 8px; }
            .course-header .title { font-size: 13px; font-weight: 700; }
            .course-header .course-name { color: #f5a400; font-weight: 800; }
            .course-table { width: 100%; border-collapse: collapse; }
            .course-table th { background: #eef4ff; font-size: 11px; font-weight: 600; color: #003b8f; padding: 8px 10px; text-align: left; border-bottom: 1px solid #d0d8e8; }
            .course-table td { font-size: 12px; padding: 8px 10px; border-bottom: 1px solid #eef4ff; }
            .feedback-box { background: #eef4ff; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
            .feedback-box .feedback-title { font-size: 13px; font-weight: 700; color: #003b8f; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
            .feedback-box p { font-size: 12px; color: #333; line-height: 1.5; margin: 0; }
            .footer { text-align: center; font-size: 10px; color: #888; font-style: italic; margin-top: 12px; }
            .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
            .badge-green { background: #07883f; color: #fff; }
            .badge-blue { background: #1d5fc4; color: #fff; }
            .badge-orange { background: #f4a000; color: #fff; }
            .overall-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
            .overall-green { background: #07883f; color: #fff; }
            .overall-blue { background: #1d5fc4; color: #fff; }
            .overall-orange { background: #f4a000; color: #fff; }
            @media print {
              .no-print { display: none !important; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="report-card">${content}</div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const overallClass = {
    "Exceeds Expectation": "overall-green",
    "Meets Expectation": "overall-blue",
    "Approaching Expectation": "overall-orange"
  }[data.overall_performance] || "overall-blue";

  const badgeClass = (label) => {
    const map = { EXCEEDING: "badge-green", MEETING: "badge-blue", APPROACHING: "badge-orange" };
    return map[label] || "badge-blue";
  };

  return (
    <div className="quiz-take-backdrop" style={{ zIndex: 1000 }}>
      <div style={{ maxWidth: "210mm", margin: "20px auto", background: "#fff", borderRadius: "16px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", padding: "24px", position: "relative" }}>
        {/* Print/Close buttons */}
        <div className="no-print" style={{ position: "absolute", top: "12px", right: "12px", display: "flex", gap: "8px" }}>
          <button type="button" onClick={handlePrint} style={{ padding: "8px 16px", background: "#003b8f", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
            🖨️ Print / PDF
          </button>
          {onClose && (
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", background: "#e5e7eb", color: "#333", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
              ✕ Close
            </button>
          )}
        </div>

        <div ref={cardRef} className="report-card" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#1a1a2e" }}>
          {/* HEADER */}
          <div className="header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div className="header-left" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {data.school.logo_url ? (
                <img src={data.school.logo_url} alt="School logo" className="school-logo" style={{ width: "60px", height: "60px", objectFit: "contain", borderRadius: "8px", border: "1px solid #d0d8e8" }} />
              ) : (
                <div style={{ width: "60px", height: "60px", borderRadius: "8px", background: "#eef4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "#003b8f", fontWeight: 700 }}>🏫</div>
              )}
            </div>
            <div className="header-center" style={{ textAlign: "center", flex: 1 }}>
              <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#003b8f", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>{data.school.name}</h1>
              <p className="club" style={{ fontSize: "13px", color: "#003b8f", fontWeight: 600, margin: "2px 0" }}>COMPUTER CLUB</p>
              <p className="term" style={{ fontSize: "12px", color: "#555", margin: 0 }}>{data.term.year} – {data.term.name.toUpperCase()}</p>
            </div>
            <div className="header-right" style={{ textAlign: "right" }}>
              <div className="educlub-logo" style={{ fontSize: "18px", fontWeight: 800, color: "#003b8f" }}>eduClub</div>
              <div className="tagline" style={{ fontSize: "10px", color: "#888" }}>Code. Learn. Create.</div>
            </div>
          </div>

          <hr className="divider" style={{ border: "none", borderTop: "2px dashed #003b8f", margin: "12px 0" }} />

          {/* STUDENT DETAILS CARD */}
          <div className="student-card" style={{ border: "1px solid #d0d8e8", borderRadius: "12px", padding: "16px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div className="student-details" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 20px", flex: 1 }}>
              <div><span className="label" style={{ fontSize: "11px", color: "#888", fontWeight: 500 }}>Student Name</span><div className="value" style={{ fontSize: "13px", color: "#1a1a2e", fontWeight: 600 }}>{data.learner.full_name}</div></div>
              <div><span className="label" style={{ fontSize: "11px", color: "#888", fontWeight: 500 }}>Class</span><div className="value" style={{ fontSize: "13px", color: "#1a1a2e", fontWeight: 600 }}>Grade {data.learner.grade}{data.learner.stream ? ` - ${data.learner.stream}` : ""}</div></div>
              <div><span className="label" style={{ fontSize: "11px", color: "#888", fontWeight: 500 }}>Lead Tutor</span><div className="value" style={{ fontSize: "13px", color: "#1a1a2e", fontWeight: 600 }}>{data.tutors.lead}</div></div>
              <div><span className="label" style={{ fontSize: "11px", color: "#888", fontWeight: 500 }}>Assistant Tutor</span><div className="value" style={{ fontSize: "13px", color: "#1a1a2e", fontWeight: 600 }}>{data.tutors.assistant}</div></div>
              <div><span className="label" style={{ fontSize: "11px", color: "#888", fontWeight: 500 }}>Member ID</span><div className="value" style={{ fontSize: "13px", color: "#1a1a2e", fontWeight: 600 }}>{data.learner.member_id}</div></div>
              <div><span className="label" style={{ fontSize: "11px", color: "#888", fontWeight: 500 }}>Attendance</span><div className="value" style={{ fontSize: "13px", color: "#1a1a2e", fontWeight: 600 }}>{data.learner.attendance}</div></div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span className="label" style={{ fontSize: "11px", color: "#888", fontWeight: 500 }}>Overall Performance</span>
                <div style={{ marginTop: "4px" }}>
                  <span className={`overall-badge ${overallClass}`} style={{ display: "inline-block", padding: "4px 14px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", backgroundColor: overallClass === "overall-green" ? "#07883f" : overallClass === "overall-blue" ? "#1d5fc4" : "#f4a000", color: "#fff" }}>
                    {data.overall_performance}
                  </span>
                </div>
              </div>
            </div>
            <div className="student-avatar" style={{ textAlign: "center", minWidth: "100px" }}>
              <div className="avatar-circle" style={{ width: "60px", height: "60px", borderRadius: "50%", background: "#003b8f", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 700, margin: "0 auto 8px" }}>
                {data.learner.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="name" style={{ fontSize: "14px", fontWeight: 700, color: "#003b8f", textTransform: "uppercase" }}>{data.learner.full_name}</div>
              <div className="class" style={{ fontSize: "11px", color: "#666" }}>Grade {data.learner.grade}</div>
            </div>
          </div>

          {/* PERFORMANCE CHARTS */}
          <div className="charts-row" style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
            {/* Typing Performance */}
            <div className="chart-card" style={{ flex: 1, border: "1px solid #d0d8e8", borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <div className="chart-header" style={{ background: "linear-gradient(135deg, #002b72, #003b8f)", color: "#fff", padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="icon" style={{ fontSize: "18px" }}>⌨️</span>
                <div>
                  <div className="title" style={{ fontSize: "13px", fontWeight: 700 }}>1. TYPING PERFORMANCE</div>
                  <div className="subtitle" style={{ fontSize: "10px", opacity: 0.8 }}>Over the Term</div>
                </div>
              </div>
              <div className="chart-body" style={{ padding: "10px" }}>
                <LineChart data={data.typing_weekly} valueKey="wpm" label="WPM" yLabel="WPM / Words Per Minute" note="* WPM (Words Per Minute)" />
              </div>
            </div>

            {/* Quiz Performance */}
            <div className="chart-card" style={{ flex: 1, border: "1px solid #d0d8e8", borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <div className="chart-header" style={{ background: "linear-gradient(135deg, #002b72, #003b8f)", color: "#fff", padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="icon" style={{ fontSize: "18px" }}>❓</span>
                <div>
                  <div className="title" style={{ fontSize: "13px", fontWeight: 700 }}>2. QUIZ PERFORMANCE</div>
                  <div className="subtitle" style={{ fontSize: "10px", opacity: 0.8 }}>Over the Term</div>
                </div>
              </div>
              <div className="chart-body" style={{ padding: "10px" }}>
                <LineChart data={data.quiz_weekly} valueKey="score" label="Score" yLabel="Score (%)" note="* Score in Percentage" />
              </div>
            </div>
          </div>

          {/* ACTIVE COURSE SECTION */}
          <div className="course-card" style={{ border: "1px solid #d0d8e8", borderRadius: "12px", overflow: "hidden", marginBottom: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div className="course-header" style={{ background: "linear-gradient(135deg, #002b72, #003b8f)", color: "#fff", padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>📘</span>
              <div className="title" style={{ fontSize: "13px", fontWeight: 700 }}>
                3. ACTIVE COURSE: <span className="course-name" style={{ color: "#f5a400", fontWeight: 800 }}>{data.course.name.toUpperCase()}</span>
              </div>
            </div>
            <table className="course-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ background: "#eef4ff", fontSize: "11px", fontWeight: 600, color: "#003b8f", padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #d0d8e8" }}>Module</th>
                  <th style={{ background: "#eef4ff", fontSize: "11px", fontWeight: 600, color: "#003b8f", padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #d0d8e8" }}>Module Description</th>
                  <th style={{ background: "#eef4ff", fontSize: "11px", fontWeight: 600, color: "#003b8f", padding: "8px 10px", textAlign: "center", borderBottom: "1px solid #d0d8e8" }}>Performance</th>
                </tr>
              </thead>
              <tbody>
                {data.course.modules.map((mod, idx) => (
                  <tr key={idx}>
                    <td style={{ fontSize: "12px", padding: "8px 10px", borderBottom: "1px solid #eef4ff", fontWeight: 500 }}>{idx + 1}. {mod.name}</td>
                    <td style={{ fontSize: "12px", padding: "8px 10px", borderBottom: "1px solid #eef4ff", color: "#555" }}>{mod.description}</td>
                    <td style={{ fontSize: "12px", padding: "8px 10px", borderBottom: "1px solid #eef4ff", textAlign: "center" }}>
                      <span className={`badge ${badgeClass(mod.performance)}`} style={{ display: "inline-block", padding: "2px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", backgroundColor: badgeClass(mod.performance) === "badge-green" ? "#07883f" : badgeClass(mod.performance) === "badge-blue" ? "#1d5fc4" : "#f4a000", color: "#fff" }}>
                        {mod.performance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TEACHER FEEDBACK */}
          <div className="feedback-box" style={{ background: "#eef4ff", borderRadius: "12px", padding: "14px", marginBottom: "12px" }}>
            <div className="feedback-title" style={{ fontSize: "13px", fontWeight: 700, color: "#003b8f", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>💬</span> TEACHER'S FEEDBACK
            </div>
            <p style={{ fontSize: "12px", color: "#333", lineHeight: 1.5, margin: 0 }}>{data.teacher_feedback}</p>
          </div>

          {/* FOOTER */}
          <div className="footer" style={{ textAlign: "center", fontSize: "10px", color: "#888", fontStyle: "italic", marginTop: "12px" }}>
            Report generated on {data.generated_at}
          </div>
        </div>
      </div>
    </div>
  );
}
