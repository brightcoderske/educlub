"use client";

import { useState } from "react";
import { FileText, Users, BookOpen, Download, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api";
import ReportCard from "./ReportCard";

export default function ReportsPanel({ schoolId, learners, streams, buildReportHtml, openLearnerDetail }) {
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

  function handleExportReport(reportData) {
    const html = buildReportHtml(reportData);
    const learnerName = (reportData.learner?.full_name || "learner").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${learnerName}-report.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleExportAll() {
    exportedReports.forEach(report => handleExportReport(report));
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
