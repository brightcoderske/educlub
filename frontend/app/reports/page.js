"use client";

import { useState, useEffect } from "react";
import { api } from "../../lib/api";

export default function ReportsPage() {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [grades, setGrades] = useState([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [streams, setStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  // Fetch available schools on mount
  useEffect(() => {
    async function fetchSchools() {
      try {
        const list = await api.get("/schools");
        setSchools(Array.isArray(list?.data) ? list.data : Array.isArray(list) ? list : []);
      } catch {
        setSchools([]);
      }
    }
    fetchSchools();
  }, []);

  // When a school is selected, fetch available grades/filters for that school
  useEffect(() => {
    if (!selectedSchool) {
      setGrades([]);
      setSelectedGrade("");
      setStreams([]);
      setSelectedStream("");
      return;
    }
    async function fetchGrades() {
      try {
        const list = await api.get(`/classes?schoolId=${selectedSchool}`);
        setGrades(Array.isArray(list) ? list : []);
      } catch {
        setGrades([]);
      }
    }
    fetchGrades();
  }, [selectedSchool]);

  // When a grade is selected, fetch streams for that grade (and school)
  useEffect(() => {
    if (!selectedGrade) {
      setStreams([]);
      setSelectedStream("");
      return;
    }
    async function fetchStreams() {
      try {
        const list = await api.get(`/streams?schoolId=${selectedSchool}&classId=${selectedGrade}`);
        setStreams(Array.isArray(list) ? list : []);
      } catch {
        setStreams([]);
      }
    }
    fetchStreams();
  }, [selectedSchool, selectedGrade]);

  // Build export payload
  const handleExport = async () => {
    setExporting(true);
    setMessage("");
    try {
      const body = {
        schoolId: selectedSchool || undefined,
        grade: selectedGrade || undefined,
        stream: selectedStream || undefined,
      };

      const response = await api.post("/reports/export", body);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Export request failed");
      }

      // Assume server returns PDF content with correct Content-Type
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${selectedSchool || "all"}-${selectedGrade || "all"}-${selectedStream || "all"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("Export completed. Download started.");
    } catch (err) {
      console.error(err);
      setMessage(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "1rem" }}>Bulk Report Export</h1>
      <p style={{ marginBottom: "1.5rem", color: "#555" }}>
        Generate a single PDF containing a separate report page for each learner. Use the
        dropdowns below to narrow the export to a specific school, grade, or stream; leave a
        field empty to include everything.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <label style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", fontSize: "0.9rem" }}>
          School
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            style={{ marginTop: "0.25rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
          >
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", fontSize: "0.9rem" }}>
          Grade / Class
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            style={{ marginTop: "0.25rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
            disabled={!selectedSchool}
          >
            <option value="">All grades</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", fontSize: "0.9rem" }}>
          Stream / Section
          <select
            value={selectedStream}
            onChange={(e) => setSelectedStream(e.target.value)}
            style={{ marginTop: "0.25rem", padding: "0.5rem", borderRadius: "6px", border: "1px solid #ccc" }}
            disabled={!selectedGrade}
          >
            <option value="">All streams</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: exporting ? "#94a3b8" : "#003b8f",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: exporting ? "not-allowed" : "pointer",
          }}
        >
          {exporting ? "Generating PDF…" : "Export Reports as PDF"}
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: "0.75rem 1rem",
            border: "1px solid #d0d8e8",
            borderRadius: "8px",
            backgroundColor: "#eef4ff",
            color: "#1a1a2e",
          }}
        >
          {message}
        </div>
      )}

      <hr style={{ margin: "2rem 0", border: "none", borderTop: "1px solid #e5e7eb" }} />
      <p style={{ fontSize: "0.85rem", color: "#888" }}>
        The PDF will start a new page for each learner and include their report card
        details, graphs, course progress, and teacher feedback.
      </p>
    </main>
  );
}
