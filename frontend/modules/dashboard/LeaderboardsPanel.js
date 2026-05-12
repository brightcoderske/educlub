"use client";

import { useState, useEffect, useMemo } from "react";
import { GraduationCap, Trophy, Keyboard, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../../lib/api";

export default function LeaderboardsPanel({ schoolId, terms }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [leaderboards, setLeaderboards] = useState({ typing: [], quiz: [], course: [] });
  const [viewAllType, setViewAllType] = useState(null);

  const uniqueTerms = useMemo(() => {
    if (!terms || !terms.length) return [];
    const currentTerm = terms.find(t => t.is_global_active);
    if (currentTerm) return [currentTerm, ...terms.filter(t => !t.is_global_active)];
    return terms;
  }, [terms]);

  const weeks = useMemo(() => {
    const weeksList = [];
    const currentTerm = terms.find(t => t.is_global_active);
    if (!currentTerm) return weeksList;
    
    const startDate = new Date(currentTerm.start_date || new Date());
    const endDate = new Date(currentTerm.end_date || new Date());
    const weekStart = new Date(startDate);
    let weekNum = 1;
    
    while (weekStart <= endDate) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > endDate) weekEnd = endDate;
      
      weeksList.push({
        value: weekNum,
        label: `Week ${weekNum} (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()})`,
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0]
      });
      
      weekStart.setDate(weekStart.getDate() + 7);
      weekNum++;
    }
    
    return weeksList;
  }, [terms]);

  useEffect(() => {
    loadLeaderboards();
  }, [schoolId, selectedTerm, selectedWeek, viewAllType]);

  async function loadLeaderboards() {
    if (!schoolId) return;
    setLoading(true);
    setError("");
    try {
      const params = {
        limit: viewAllType ? 100 : 5,
        offset: 0
      };
      
      if (selectedTerm) {
        params.term_id = selectedTerm;
      }
      
      if (selectedWeek) {
        const week = weeks.find(w => w.value === parseInt(selectedWeek));
        if (week) {
          params.week_start = week.startDate;
          params.week_end = week.endDate;
        }
      }
      
      if (viewAllType) {
        params.type = viewAllType;
        params.include_all = "true";
      }

      const result = await api.get(`/school-admin/leaderboards?${new URLSearchParams(params)}`);
      
      if (viewAllType) {
        setLeaderboards(prev => ({ ...prev, [viewAllType]: result.rows || [] }));
      } else {
        setLeaderboards({
          typing: result.typing || [],
          quiz: result.quiz || [],
          course: result.course || []
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleViewAll(type, courseId = null) {
    if (viewAllType === type) {
      setViewAllType(null);
    } else {
      setViewAllType(type);
    }
  }

  const leaderboardConfig = {
    typing: {
      title: "Weekly Typing Leaderboard",
      icon: Keyboard,
      scoreLabel: "WPM",
      color: "#003b8f"
    },
    quiz: {
      title: "Weekly Quiz Leaderboard",
      icon: Trophy,
      scoreLabel: "Score",
      color: "#07883f"
    },
    course: {
      title: "Active Course Progress",
      icon: BookOpen,
      scoreLabel: "Progress",
      color: "#f4a000"
    }
  };

  return (
    <section className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ margin: 0 }}>School Leaderboards</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
            Term:
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #d0d8e8", fontSize: "14px" }}
            >
              <option value="">Current Term</option>
              {uniqueTerms.map(term => (
                <option key={term.id} value={term.id}>
                  {term.year} - {term.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
            Week:
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #d0d8e8", fontSize: "14px" }}
            >
              <option value="">All Weeks</option>
              {weeks.map(week => (
                <option key={week.value} value={week.value}>
                  {week.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Typing Leaderboard */}
        <LeaderboardCard
          type="typing"
          config={leaderboardConfig.typing}
          entries={leaderboards.typing || []}
          loading={loading && viewAllType === "typing"}
          isViewingAll={viewAllType === "typing"}
          onViewAll={() => handleViewAll("typing")}
        />

        {/* Quiz Leaderboard */}
        <LeaderboardCard
          type="quiz"
          config={leaderboardConfig.quiz}
          entries={leaderboards.quiz || []}
          loading={loading && viewAllType === "quiz"}
          isViewingAll={viewAllType === "quiz"}
          onViewAll={() => handleViewAll("quiz")}
        />

        {/* Course Leaderboard */}
        <LeaderboardCard
          type="course"
          config={leaderboardConfig.course}
          entries={leaderboards.course || []}
          loading={loading && viewAllType === "course"}
          isViewingAll={viewAllType === "course"}
          onViewAll={() => handleViewAll("course")}
        />
      </div>
    </section>
  );
}

function LeaderboardCard({ type, config, entries, loading, isViewingAll, onViewAll }) {
  const Icon = config.icon;

  return (
    <div className="panel compact-panel" style={{ borderLeft: `4px solid ${config.color}` }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #eef4ff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Icon size={20} style={{ color: config.color }} />
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{config.title}</h3>
          <span style={{ fontSize: "12px", color: "#666", backgroundColor: "#eef4ff", padding: "2px 8px", borderRadius: "12px" }}>
            {entries.length} learner{entries.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#666" }}>Loading...</p>
        ) : entries.length === 0 ? (
          <p style={{ textAlign: "center", color: "#666", padding: "20px" }}>No entries yet for this leaderboard</p>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #eef4ff" }}>
                  <th style={{ textAlign: "left", padding: "8px", fontSize: "12px", color: "#666", fontWeight: 600 }}>Rank</th>
                  <th style={{ textAlign: "left", padding: "8px", fontSize: "12px", color: "#666", fontWeight: 600 }}>Learner</th>
                  <th style={{ textAlign: "left", padding: "8px", fontSize: "12px", color: "#666", fontWeight: 600 }}>Grade</th>
                  <th style={{ textAlign: "right", padding: "8px", fontSize: "12px", color: "#666", fontWeight: 600 }}>{config.scoreLabel}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={entry.id || idx} style={{ borderBottom: "1px solid #eef4ff" }}>
                    <td style={{ padding: "8px", fontWeight: 600 }}>
                      {entry.rank > 0 ? (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          backgroundColor: entry.rank === 1 ? "#ffd700" : entry.rank === 2 ? "#c0c0c0" : entry.rank === 3 ? "#cd7f32" : "#eef4ff",
                          color: entry.rank <= 3 ? "#fff" : "#666",
                          fontSize: "12px",
                          fontWeight: 700
                        }}>
                          {entry.rank}
                        </span>
                      ) : (
                        <span style={{ color: "#999", fontSize: "12px" }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: "8px" }}>{entry.learner_name}</td>
                    <td style={{ padding: "8px", color: "#666" }}>Grade {entry.grade}{entry.stream ? ` - ${entry.stream}` : ""}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>
                      {entry.score > 0 ? Number(entry.score).toFixed(type === "typing" ? 0 : 1) : "0"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!isViewingAll && entries.length >= 5 && (
              <button
                type="button"
                onClick={onViewAll}
                style={{
                  marginTop: "12px",
                  padding: "8px 16px",
                  backgroundColor: "#eef4ff",
                  color: "#003b8f",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600
                }}
              >
                View All Learners
              </button>
            )}
            {isViewingAll && (
              <button
                type="button"
                onClick={onViewAll}
                style={{
                  marginTop: "12px",
                  padding: "8px 16px",
                  backgroundColor: "#eef4ff",
                  color: "#003b8f",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600
                }}
              >
                Show Top 5
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
