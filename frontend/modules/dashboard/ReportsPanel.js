"use client";

import { useState, useEffect } from "react";
import { FileText, Users, BookOpen, Download, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api";
import ReportCard from "./ReportCard";
import JSZip from "jszip";

function buildReportHtml(reportData) {
  const data = reportData || {};
  const school = data.school || { name: "School", logo_url: "" };
  const learner = data.learner || { full_name: "Learner", grade: "-", stream: "", member_id: "-", attendance: "-" };
  const term = data.term || { year: new Date().getFullYear(), name: "Term" };
  const tutors = data.tutors || { lead: "-", assistant: "-" };
  const course = data.course || { name: "Course", modules: [] };
  const modules = Array.isArray(course.modules) ? course.modules : [];
  const overallPerformance = data.overall_performance || "Meets Expectation";
  const teacherFeedback = data.teacher_feedback || "No feedback yet.";
  const typingWeekly = data.typing_weekly || [];
  const quizWeekly = data.quiz_weekly || [];

  const overallColor = {
    "Exceeds Expectation": "#07883f",
    "Meets Expectation": "#1d5fc4",
    "Approaching Expectation": "#f4a000"
  }[overallPerformance] || "#1d5fc4";

  const badgeColor = (label) => {
    const map = { EXCEEDING: "#07883f", MEETING: "#1d5fc4", APPROACHING: "#f4a000" };
    return map[label] || "#1d5fc4";
  };

  function generateLineChart(data, valueKey, yLabel) {
    const rows = Array.isArray(data) ? data.filter((item) => Number.isFinite(Number(item[valueKey]))) : [];
    if (!rows.length) {
      return `<div style="height: 160px; display: flex; align-items: center; justify-content: center; color: #667085; font-size: 12px; text-align: center; padding: 12px;">No data recorded yet.</div>`;
    }
    const maxVal = Math.max(...rows.map(d => Number(d[valueKey])), valueKey === "score" ? 100 : 10);
    const width = 280;
    const height = 160;
    const padding = { top: 20, right: 20, bottom: 40, left: 40 };
    const xStep = (width - padding.left - padding.right) / (rows.length - 1 || 1);

    const points = rows.map((d, i) => {
      const x = rows.length === 1 ? width / 2 : padding.left + i * xStep;
      const value = Number(d[valueKey]);
      const y = padding.top + (height - padding.top - padding.bottom) * (1 - value / maxVal);
      return { x, y, value, week: d.week || i + 1 };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; max-height: 180px;">`;
    svg += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="#ccc" stroke-width="1" />`;
    svg += `<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="#ccc" stroke-width="1" />`;
    svg += `<text x="12" y="${height / 2}" text-anchor="middle" transform="rotate(-90 12 ${height / 2})" style="font-size: 10px; fill: #666;">${yLabel}</text>`;
    svg += `<path d="${linePath}" fill="none" stroke="#003b8f" stroke-width="2" />`;
    points.forEach((p, i) => {
      svg += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#003b8f" stroke="#fff" stroke-width="2" />`;
      svg += `<text x="${p.x}" y="${p.y - 10}" text-anchor="middle" style="font-size: 10px; font-weight: 600; fill: #003b8f;">${Number(p.value).toFixed(valueKey === "score" ? 1 : 0)}</text>`;
    });
    rows.forEach((d, i) => {
      svg += `<text x="${rows.length === 1 ? width / 2 : padding.left + i * xStep}" y="${height - padding.bottom + 16}" text-anchor="middle" style="font-size: 9px; fill: #666;">Week ${d.week || i + 1}</text>`;
    });
    svg += `</svg>`;

    return svg;
  }

  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${learner.full_name} - Report Card</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; margin: 0; padding: 20px; background: #f5f5f5; }
    .report-card { background: #fff; max-width: 210mm; margin: 0 auto; padding: 24px; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .header-center { text-align: center; flex: 1; }
    .header-center h1 { font-size: 22px; font-weight: 800; color: #003b8f; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
    .club { font-size: 13px; color: #003b8f; font-weight: 600; margin: 2px 0; }
    .term { font-size: 12px; color: #555; margin: 0; }
    .divider { border: none; border-top: 2px dashed #003b8f; margin: 12px 0; }
    .student-card { border: 1px solid #d0d8e8; border-radius: 12px; padding: 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .student-details { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; flex: 1; }
    .label { font-size: 11px; color: #888; font-weight: 500; }
    .value { font-size: 13px; color: #1a1a2e; font-weight: 600; }
    .overall-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; }
    .student-avatar { text-align: center; min-width: 100px; }
    .avatar-circle { width: 60px; height: 60px; border-radius: 50%; background: #003b8f; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; margin: 0 auto 8px; }
    .charts-row { display: flex; gap: 16px; margin-bottom: 16px; }
    .chart-card { flex: 1; border: 1px solid #d0d8e8; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .chart-header { background: linear-gradient(135deg, #002b72, #003b8f); color: #fff; padding: 10px 14px; display: flex; align-items: center; gap: 8px; }
    .chart-header .title { font-size: 13px; font-weight: 700; }
    .chart-header .subtitle { font-size: 10px; opacity: 0.8; }
    .chart-body { padding: 10px; }
    .course-card { border: 1px solid #d0d8e8; border-radius: 12px; overflow: hidden; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .course-header { background: linear-gradient(135deg, #002b72, #003b8f); color: #fff; padding: 10px 14px; display: flex; align-items: center; gap: 8px; }
    .course-header .title { font-size: 13px; font-weight: 700; }
    .course-name { color: #f5a400; font-weight: 800; }
    .course-table { width: 100%; border-collapse: collapse; }
    .course-table th { background: #eef4ff; font-size: 11px; font-weight: 600; color: #003b8f; padding: 8px 10px; text-align: left; border-bottom: 1px solid #d0d8e8; }
    .course-table td { font-size: 12px; padding: 8px 10px; border-bottom: 1px solid #eef4ff; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; }
    .feedback-box { background: #eef4ff; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
    .feedback-title { font-size: 13px; font-weight: 700; color: #003b8f; margin-bottom: 6px; }
    .footer { text-align: center; font-size: 10px; color: #888; font-style: italic; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="report-card">
    <div class="header">
      <div class="header-left">
        ${school.logo_url ? `<img src="${school.logo_url}" alt="School logo" style="width: 60px; height: 60px; object-fit: contain; border-radius: 8px; border: 1px solid #d0d8e8;" />` : `<div style="width: 60px; height: 60px; border-radius: 8px; background: #eef4ff; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #003b8f; font-weight: 700;">🏫</div>`}
      </div>
      <div class="header-center">
        <h1>${school.name}</h1>
        <p class="club">COMPUTER CLUB</p>
        <p class="term">${term.year} – ${String(term.name).toUpperCase()}</p>
      </div>
      <div class="header-right">
        <div style="font-size: 18px; font-weight: 800; color: #003b8f;">eduClub</div>
        <div style="font-size: 10px; color: #888;">Code. Learn. Create.</div>
      </div>
    </div>

    <hr class="divider" />

    <div class="student-card">
      <div class="student-details">
        <div><span class="label">Student Name</span><div class="value">${learner.full_name}</div></div>
        <div><span class="label">Class</span><div class="value">Grade ${learner.grade}${learner.stream ? ` - ${learner.stream}` : ""}</div></div>
        <div><span class="label">Lead Tutor</span><div class="value">${tutors.lead}</div></div>
        <div><span class="label">Assistant Tutor</span><div class="value">${tutors.assistant}</div></div>
        <div><span class="label">Member ID</span><div class="value">${learner.member_id}</div></div>
        <div><span class="label">Attendance</span><div class="value">${learner.attendance}</div></div>
        <div style="grid-column: 1 / -1;">
          <span class="label">Overall Performance</span>
          <div style="margin-top: 4px;">
            <span class="overall-badge" style="background-color: ${overallColor};">${overallPerformance}</span>
          </div>
        </div>
      </div>
      <div class="student-avatar">
        <div class="avatar-circle">${learner.full_name.charAt(0).toUpperCase()}</div>
        <div style="font-size: 14px; font-weight: 700; color: #003b8f; text-transform: uppercase;">${learner.full_name}</div>
        <div style="font-size: 11px; color: #666;">Grade ${learner.grade}</div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-header">
          <span style="font-size: 18px;">⌨️</span>
          <div>
            <div class="title">1. TYPING PERFORMANCE</div>
            <div class="subtitle">Over the Term</div>
          </div>
        </div>
        <div class="chart-body">
          ${generateLineChart(typingWeekly, "wpm", "WPM / Words Per Minute")}
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <span style="font-size: 18px;">❓</span>
          <div>
            <div class="title">2. QUIZ PERFORMANCE</div>
            <div class="subtitle">Over the Term</div>
          </div>
        </div>
        <div class="chart-body">
          ${generateLineChart(quizWeekly, "score", "Score (%)")}
        </div>
      </div>
    </div>

    <div class="course-card">
      <div class="course-header">
        <span style="font-size: 16px;">📘</span>
        <div class="title">3. ACTIVE COURSE: <span class="course-name">${course.name.toUpperCase()}</span></div>
      </div>
      <table class="course-table">
        <thead>
          <tr>
            <th>Module</th>
            <th>Module Description</th>
            <th style="text-align: center;">Performance</th>
          </tr>
        </thead>
        <tbody>
          ${modules.length ? modules.map((mod, idx) => `
            <tr>
              <td>${idx + 1}. ${mod.name}</td>
              <td style="color: #555;">${mod.description}</td>
              <td style="text-align: center;">
                <span class="badge" style="background-color: ${badgeColor(mod.performance)};">${mod.performance}</span>
              </td>
            </tr>
          `).join("") : `<tr><td colspan="3" style="text-align: center; color: #667085;">No lesson scores recorded for this course yet.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="feedback-box">
      <div class="feedback-title">💬 TEACHER'S FEEDBACK</div>
      <p style="font-size: 12px; color: #333; line-height: 1.5; margin: 0;">${teacherFeedback}</p>
    </div>

    <div class="footer">
      Report generated on ${data.generated_at || new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
    </div>
  </div>
</body>
</html>`;

  return html;
}

export default function ReportsPanel({ schoolId, learners, streams, openLearnerDetail }) {
  const [mode, setMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLearner, setSelectedLearner] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedStream, setSelectedStream] = useState("");
  const [exportedReports, setExportedReports] = useState([]);
  const [showReportCard, setShowReportCard] = useState(false);
  const [libsLoaded, setLibsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    setLibsLoaded(true);
  }, []);

  const uniqueGrades = Array.from(new Set(learners.map(l => l.grade).filter(Boolean))).sort((a, b) => a - b);

  async function handleSearchLearners(term) {
    setSearchTerm(term);
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await api.get(`/reports/search-learners?schoolId=${schoolId}&search=${encodeURIComponent(term)}`);
      setSearchResults(results);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateIndividual(learnerId) {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const reportData = await api.post("/reports/generate-learner", { schoolId, learnerId });
      setSelectedLearner(reportData);
      setSuccess("Report generated successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateClass() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await api.post("/reports/export", { schoolId, grade: selectedGrade || undefined, stream: selectedStream || undefined });
      setExportedReports(result.reports || []);
      setSuccess(`Generated ${result.count} report(s) for ${selectedGrade ? `Grade ${selectedGrade}` : "all grades"}${selectedStream ? ` - ${selectedStream}` : ""}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateWholeSchool() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await api.post("/reports/export", { schoolId });
      setExportedReports(result.reports || []);
      setSuccess(`Generated ${result.count} report(s) for the whole school`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function generatePdfBlob(reportData) {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const html = buildReportHtml(reportData);
    const learnerName = (reportData.learner?.full_name || "learner").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    
    const element = document.createElement("div");
    element.innerHTML = html;
    element.style.position = "absolute";
    element.style.left = "-9999px";
    element.style.top = "0";
    element.style.width = "210mm";
    element.style.background = "#fff";
    element.style.padding = "0";
    document.body.appendChild(element);
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 794,
        windowHeight: 1123
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait"
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = 0;
      const imgY = 0;
      
      pdf.addImage(imgData, "JPEG", imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      document.body.removeChild(element);
      return pdf.output("blob");
    } catch (error) {
      document.body.removeChild(element);
      throw error;
    }
  }

  async function handleExportReport(reportData) {
    try {
      const pdfBlob = await generatePdfBlob(reportData);
      const learnerName = (reportData.learner?.full_name || "learner").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
      const url = URL.createObjectURL(pdfBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${learnerName}-report.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Failed to generate PDF: ${err.message}`);
    }
  }

  async function handleExportAll() {
    if (exportedReports.length === 0) return;
    
    setLoading(true);
    setError("");
    try {
      const zip = new JSZip();
      
      for (const report of exportedReports) {
        const pdfBlob = await generatePdfBlob(report);
        const learnerName = (report.learner?.full_name || "learner").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
        zip.file(`${learnerName}-report.pdf`, pdfBlob);
      }
      
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `school-reports-${new Date().toISOString().split("T")[0]}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      
      setSuccess(`Downloaded ${exportedReports.length} report(s) as ZIP`);
    } catch (err) {
      setError(`Failed to generate ZIP: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function resetPanel() {
    setMode(null);
    setSelectedLearner(null);
    setExportedReports([]);
    setError("");
    setSuccess("");
    setSearchTerm("");
    setSearchResults([]);
    setShowReportCard(false);
  }

  if (!mode) {
    return (
      <section className="panel">
        <h2>Report Card Shortcuts</h2>
        <div className="shortcut-grid">
          <button type="button" onClick={() => setMode("individual")}>
            <FileText size={18} />Generate individual
          </button>
          <button type="button" onClick={() => setMode("class")}>
            <Users size={18} />Generate class
          </button>
          <button type="button" onClick={() => setMode("whole-school")}>
            <BookOpen size={18} />Generate whole school
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: 0 }}>
          {mode === "individual" && "Generate Individual Report"}
          {mode === "class" && "Generate Class Reports"}
          {mode === "whole-school" && "Generate Whole School Reports"}
        </h2>
        <button type="button" className="link-button" onClick={resetPanel}>Back to shortcuts</button>
      </div>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert success-alert">{success}</div>}

      {mode === "individual" && (
        <div>
          <div className="form-row" style={{ marginBottom: "16px" }}>
            <label style={{ display: "block" }}>
              Search learner
              <input
                type="text"
                placeholder="Enter name or username"
                value={searchTerm}
                onChange={(e) => handleSearchLearners(e.target.value)}
                style={{ width: "100%", marginTop: "4px" }}
              />
            </label>
          </div>
          {searchResults.length > 0 && (
            <div className="search-results" style={{ marginBottom: "16px" }}>
              <p className="helper-text">Select a learner to generate report:</p>
              <div className="result-list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {searchResults.map(learner => (
                  <button
                    type="button"
                    key={learner.id}
                    className="result-item"
                    onClick={() => handleGenerateIndividual(learner.id)}
                    disabled={loading}
                    style={{ textAlign: "left", padding: "12px", border: "1px solid #d0d8e8", borderRadius: "8px", background: "#fff", cursor: "pointer" }}
                  >
                    <strong>{learner.full_name}</strong>
                    <span style={{ marginLeft: "8px", color: "#666" }}>Grade {learner.grade}{learner.stream ? ` - ${learner.stream}` : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {loading && <p>Generating report...</p>}
          {selectedLearner && (
            <div className="report-preview">
              <div className="report-actions" style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                <button type="button" onClick={() => handleExportReport(selectedLearner)}>
                  <Download size={16} />Download HTML
                </button>
                <button type="button" onClick={() => setShowReportCard(true)}>
                  <FileText size={16} />View report card
                </button>
              </div>
              {showReportCard && (
                <ReportCard
                  data={{
                    school: { name: selectedLearner.school?.name || "School", logo_url: selectedLearner.school?.logo_url || "" },
                    learner: { ...selectedLearner.learner, member_id: selectedLearner.learner?.username || "", attendance: "-" },
                    term: selectedLearner.term || { year: new Date().getFullYear(), name: "Term" },
                    tutors: { lead: "-", assistant: "-" },
                    overall_performance: selectedLearner.report?.overall_performance || "Meets Expectation",
                    typing_weekly: selectedLearner.typing_weekly || [],
                    quiz_weekly: selectedLearner.quiz_weekly || [],
                    course: selectedLearner.course || { name: "Course", modules: [] },
                    teacher_feedback: selectedLearner.report?.teacher_remarks || "No feedback yet.",
                    generated_at: new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })
                  }}
                  onClose={() => setShowReportCard(false)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {mode === "class" && (
        <div>
          <div className="form-row" style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
            <label style={{ flex: 1 }}>
              Grade
              <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} style={{ width: "100%", marginTop: "4px" }}>
                <option value="">All grades</option>
                {uniqueGrades.map(grade => <option key={grade} value={grade}>Grade {grade}</option>)}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              Stream
              <select value={selectedStream} onChange={(e) => setSelectedStream(e.target.value)} style={{ width: "100%", marginTop: "4px" }}>
                <option value="">All streams</option>
                {streams.map(stream => <option key={stream.id} value={stream.name}>{stream.name}</option>)}
              </select>
            </label>
          </div>
          <button type="button" disabled={loading} onClick={handleGenerateClass} style={{ marginBottom: "16px" }}>
            {loading ? "Generating..." : <><CheckCircle2 size={16} />Generate reports</>}
          </button>
          {exportedReports.length > 0 && (
            <div className="export-results">
              <div className="export-actions" style={{ marginBottom: "8px" }}>
                <button type="button" onClick={handleExportAll}>
                  <Download size={16} />Download all reports ({exportedReports.length})
                </button>
              </div>
              <p className="helper-text">{exportedReports.length} report(s) generated. Click to download as HTML files.</p>
            </div>
          )}
        </div>
      )}

      {mode === "whole-school" && (
        <div>
          <p className="helper-text" style={{ marginBottom: "16px" }}>This will generate reports for all learners in the school. This may take some time for larger schools.</p>
          <button type="button" disabled={loading} onClick={handleGenerateWholeSchool} style={{ marginBottom: "16px" }}>
            {loading ? "Generating..." : <><CheckCircle2 size={16} />Generate all reports</>}
          </button>
          {exportedReports.length > 0 && (
            <div className="export-results">
              <div className="export-actions" style={{ marginBottom: "8px" }}>
                <button type="button" onClick={handleExportAll}>
                  <Download size={16} />Download all reports ({exportedReports.length})
                </button>
              </div>
              <p className="helper-text">{exportedReports.length} report(s) generated. Click to download as HTML files.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
