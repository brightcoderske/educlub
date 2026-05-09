const jwt = require("jsonwebtoken");
const { env } = require("../config/env");
const db = require("../config/database");

const BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:4000/api";

async function getJson(path, token) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function tokenFor(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      school_id: user.school_id,
      full_name: user.full_name || user.name,
      email: user.email
    },
    env.jwtSecret,
    { expiresIn: "15m" }
  );
}

async function checkSystemAdmin() {
  const user = await db.one("select id, role, school_id, full_name, name, email from users where role = 'system_admin' and deleted_at is null limit 1");
  if (!user) {
    console.log("system admin skipped: no user");
    return;
  }
  const token = tokenFor(user);
  const paths = [
    "/analytics/system-admin/summary",
    "/schools",
    "/terms",
    "/users",
    "/courses",
    "/quizzes/global",
    "/quizzes/global-questions",
    "/leaderboards",
    "/analytics/audit-logs",
    "/analytics/system-admin/school-performance"
  ];
  for (const path of paths) {
    await getJson(path, token);
    console.log("system ok", path);
  }
}

async function checkSchoolAdmin() {
  const user = await db.one("select id, role, school_id, full_name, name, email from users where role = 'school_admin' and school_id is not null and deleted_at is null limit 1");
  if (!user) {
    console.log("school admin skipped: no user");
    return;
  }
  const token = tokenFor(user);
  const paths = [
    "/school-admin/profile",
    "/school-admin/summary",
    "/school-admin/enrolment-by-course",
    "/school-admin/class-progress",
    "/school-admin/learners",
    "/school-admin/submissions",
    "/school-admin/typing-results",
    "/school-admin/quiz-results",
    "/school-admin/global-quizzes",
    "/school-admin/school-quizzes",
    "/school-admin/quiz-assignments",
    "/school-admin/quiz-performance",
    "/school-admin/leaderboards",
    "/school-admin/preferences",
    "/school-admin/streams",
    "/school-admin/courses",
    "/school-admin/terms"
  ];
  for (const path of paths) {
    await getJson(path, token);
    console.log("school ok", path);
  }
}

async function checkStudent() {
  const user = await db.one("select id, role, school_id, full_name, name, email, username from users where role = 'student' and school_id is not null and deleted_at is null limit 1");
  if (!user) {
    console.log("student skipped: no user");
    return;
  }
  const token = tokenFor(user);
  await getJson("/student/dashboard", token);
  console.log("student ok /student/dashboard");
}

async function main() {
  await checkSystemAdmin();
  await checkSchoolAdmin();
  await checkStudent();
}

main()
  .catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
