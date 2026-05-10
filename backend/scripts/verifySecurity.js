require("dotenv").config();

const { query, pool } = require("../config/database");

const tables = [
  "academic_years",
  "terms",
  "schools",
  "school_active_terms",
  "users",
  "grade_history",
  "courses",
  "modules",
  "lessons",
  "school_lesson_annotations",
  "practice_tasks",
  "enrolments",
  "lesson_progress",
  "quiz_questions",
  "quiz_question_school_visibility",
  "quizzes",
  "quiz_items",
  "quiz_attempts",
  "quiz_assignments",
  "typing_results",
  "typing_tests",
  "typing_assignments",
  "typing_attempts",
  "submissions",
  "report_cards",
  "leaderboard_entries",
  "school_preferences",
  "school_streams",
  "audit_logs"
];

async function main() {
  const result = await query(
    `select relname, relrowsecurity
     from pg_class
     join pg_namespace on pg_namespace.oid = pg_class.relnamespace
     where nspname = $1 and relname = any($2::text[])
     order by relname`,
    ["public", tables]
  );

  const missingTables = tables.filter((table) => !result.rows.some((row) => row.relname === table));
  const missingRls = tables.filter((table) => !result.rows.some((row) => row.relname === table && row.relrowsecurity));

  if (missingTables.length || missingRls.length) {
    throw new Error(`Security verification failed: ${JSON.stringify({ missingTables, missingRls })}`);
  }

  console.log(`Security verification passed: RLS enabled on ${result.rows.length} application tables.`);
  await pool.end();
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  await pool.end();
  process.exit(1);
});
