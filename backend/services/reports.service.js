const { one, query } = require("../config/database");

function avg(rows, key) {
  const v = rows.map(r => Number(r[key])).filter(v => Number.isFinite(v));
  if (!v.length) return null;
  return v.reduce((s, x) => s + x, 0) / v.length;
}

async function fetchLearnerReport(schoolId, learnerId, termId) {
  const learner = await one(
    "select id, coalesce(full_name, name) as full_name, username, grade, stream from users where id=$1 and school_id=$2 and role='student' and deleted_at is null",
    [learnerId, schoolId]
  );
  if (!learner) return null;
  const school = await one("select id, name, logo_url from schools where id=$1", [schoolId]);
  const term = termId ? await one(
    "select t.id, coalesce(t.label, t.name::text) as name, ay.year from terms t join academic_years ay on ay.id=t.academic_year_id where t.id=$1",
    [termId]
  ) : null;

  const [typing, quizzes, progress, quizTrend, typingTrend, reports] = await Promise.all([
    query("select tr.wpm, tr.accuracy, tr.created_at from (select learner_id, school_id, term_id, wpm, accuracy, created_at from typing_results union all select learner_id, school_id, term_id, wpm, accuracy, created_at from typing_attempts) tr where tr.school_id=$1 and tr.learner_id=$2 and ($3::uuid is null or tr.term_id=$3) order by tr.created_at desc", [schoolId, learnerId, termId]),
    query("select qa.score, qa.created_at from quiz_attempts qa where qa.school_id=$1 and qa.learner_id=$2 and ($3::uuid is null or qa.term_id=$3) order by qa.created_at desc", [schoolId, learnerId, termId]),
    query("select m.title as module_name, lp.score from lesson_progress lp join modules m on m.id=lp.module_id where lp.learner_id=$1 order by lp.updated_at desc", [learnerId]),
    query("select date_trunc('week', qa.created_at)::date as week_start, avg(qa.score)::numeric as average_score from quiz_attempts qa where qa.school_id=$1 and qa.learner_id=$2 and ($3::uuid is null or qa.term_id=$3) group by 1 order by 1", [schoolId, learnerId, termId]),
    query("select date_trunc('week', ta.created_at)::date as week_start, avg(ta.wpm)::numeric as average_wpm from typing_attempts ta where ta.school_id=$1 and ta.learner_id=$2 and ($3::uuid is null or ta.term_id=$3) group by 1 order by 1", [schoolId, learnerId, termId]),
    query("select teacher_remarks from report_cards where school_id=$1 and learner_id=$2 and ($3::uuid is null or term_id=$3) order by created_at desc limit 1", [schoolId, learnerId, termId])
  ]);

  const typingWeekly = typingTrend.rows.map((r, i) => ({ week: i + 1, wpm: Math.round(Number(r.average_wpm || 0)) }));
  const quizWeekly = quizTrend.rows.map((r, i) => ({ week: i + 1, score: Math.round(Number(r.average_score || 0)) }));

  const quizAvg = avg(quizzes.rows, "score");
  const typingAvg = avg(typing.rows, "wpm");
  let overallPerformance = "Approaching Expectation";
  if (quizAvg != null || typingAvg != null) {
    const qn = quizAvg != null ? quizAvg : 0;
    const tn = typingAvg != null ? Math.min(typingAvg / 50 * 100, 100) : 0;
    const combined = (qn * 0.6) + (tn * 0.4);
    if (combined > 80) overallPerformance = "Exceeds Expectation";
    else if (combined > 50) overallPerformance = "Meets Expectation";
  }

  const modulePerf = {};
  for (const item of progress.rows) {
    if (!item.module_name) continue;
    const s = Number(item.score);
    if (!Number.isFinite(s)) continue;
    if (!modulePerf[item.module_name]) modulePerf[item.module_name] = { total: 0, count: 0 };
    modulePerf[item.module_name].total += s;
    modulePerf[item.module_name].count += 1;
  }
  const modules = Object.entries(modulePerf).map(([name, d]) => {
    const a = d.total / d.count;
    return { name, description: "", performance: a <= 50 ? "APPROACHING" : a <= 80 ? "MEETING" : "EXCEEDING" };
  });

  return {
    learner, school, term,
    typing_weekly: typingWeekly,
    quiz_weekly: quizWeekly,
    course: {
      name: progress.rows[0]?.course_name || "Course",
      modules: modules.length ? modules : [{ name: "No modules started", description: "Complete lessons to see module performance.", performance: "APPROACHING" }]
    },
    report: {
      typing_summary: { attempts: typing.rows.length, average_wpm: typingAvg, average_accuracy: avg(typing.rows, "accuracy") },
      quiz_summary: { attempts: quizzes.rows.length, average_score: quizAvg },
      overall_performance: overallPerformance,
      teacher_remarks: reports.rows[0]?.teacher_remarks || null
    }
  };
}

async function exportBulkReports(filters = {}) {
  const { schoolId, grade, stream } = filters;
  let q = "select id, school_id from users where role='student' and deleted_at is null";
  const params = [];
  let pi = 1;
  if (schoolId) { q += ` and school_id=$${pi++}`; params.push(schoolId); }
  if (grade) { q += ` and grade=$${pi++}`; params.push(grade); }
  if (stream) { q += ` and stream=$${pi++}`; params.push(stream); }
  q += " order by school_id, grade, stream, coalesce(full_name, name)";

  const learners = await query(q, params);
  const reports = [];
  for (const row of learners.rows) {
    const data = await fetchLearnerReport(row.school_id, row.id, null);
    if (data) reports.push(data);
  }
  return reports;
}

async function searchLearners(schoolId, searchTerm) {
  const result = await query(
    "select id, coalesce(full_name, name) as full_name, username, grade, stream from users where school_id=$1 and role='student' and deleted_at is null and (coalesce(full_name, name) ilike $2 or username ilike $2) order by coalesce(full_name, name) limit 20",
    [schoolId, `%${searchTerm}%`]
  );
  return result.rows;
}

module.exports = { exportBulkReports, fetchLearnerReport, searchLearners };
