const db = require("../config/database");
const schoolAdmin = require("../services/schoolAdmin.service");
const systemAdmin = require("../services/systemAdmin.service");
const student = require("../services/student.service");

async function main() {
  const admin = await db.one(
    "select id, school_id, role from users where role = 'school_admin' and school_id is not null and deleted_at is null limit 1"
  );
  const courses = await systemAdmin.listCourses({ pageSize: 3 });
  console.log("courses ok", courses.data.length);

  if (!admin) {
    console.log("school admin scoped checks skipped: no school admin found");
    return;
  }

  const actor = { sub: admin.id, role: "school_admin", school_id: admin.school_id };
  const terms = await schoolAdmin.terms(actor);
  console.log("terms ok", terms.length);

  const learner = await db.one(
    "select id from users where role = 'student' and school_id = $1 and deleted_at is null limit 1",
    [admin.school_id]
  );

  if (!learner) {
    console.log("learner detail skipped: no learners for first school admin school");
    return;
  }

  const detail = await schoolAdmin.learnerDetail(actor, learner.id, {});
  console.log(
    "learner detail ok",
    detail.learner.full_name,
    detail.course_history.length,
    detail.quiz_results.length,
    detail.typing_results.length
  );

  const studentDashboard = await student.dashboard({ sub: learner.id, role: "student", school_id: admin.school_id });
  console.log("student dashboard ok", studentDashboard.learner.full_name, studentDashboard.courses.length);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end();
  });
