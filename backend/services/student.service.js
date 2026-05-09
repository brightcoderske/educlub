const { one, query } = require("../config/database");

function assertStudent(user) {
  if (!user || user.role !== "student") {
    const error = new Error("Learner access required");
    error.statusCode = 403;
    throw error;
  }
  if (!user.school_id) {
    const error = new Error("Learner must belong to a school");
    error.statusCode = 403;
    throw error;
  }
}

function average(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function learnerContext(user) {
  assertStudent(user);
  const learner = await one(
    `select u.id, u.school_id, coalesce(u.full_name, u.name) as full_name, u.username, u.grade, u.stream,
            u.last_login_at, u.previous_login_at, s.name as school_name, lp.id as learner_profile_id
     from users u
     join schools s on s.id = u.school_id
     left join learner_profiles lp on lp.user_id = u.id and lp.school_id = u.school_id
     where u.id = $1 and u.school_id = $2 and u.role = 'student' and u.deleted_at is null and u.is_active = true`,
    [user.sub, user.school_id]
  );

  if (!learner) {
    const error = new Error("Learner profile not found");
    error.statusCode = 404;
    throw error;
  }

  const activeTerm = await one(
    `select t.id, t.name, t.starts_on, t.ends_on, ay.year
     from school_active_terms sat
     join terms t on t.id = sat.term_id
     join academic_years ay on ay.id = t.academic_year_id
     where sat.school_id = $1`,
    [user.school_id]
  );

  return { learner, activeTerm };
}

async function dashboard(user, params = {}) {
  const { learner, activeTerm } = await learnerContext(user);
  const termId = params.term_id || activeTerm?.id || null;
  const profileId = learner.learner_profile_id || null;

  const [courses, progress, typing, quizzes, reports, leaderboards, submissions] = await Promise.all([
    query(
      `select e.id as enrolment_id, e.status, e.created_at, e.term_id,
              coalesce(c.name, c.title) as course_name, c.id as course_id, c.club, coalesce(c.objectives, c.description) as objectives,
              t.name as term_name, ay.year
       from enrolments e
       join courses c on c.id = e.course_id
       join terms t on t.id = e.term_id
       join academic_years ay on ay.id = t.academic_year_id
       where e.school_id = $1 and e.learner_id = $2 and ($3::uuid is null or e.term_id = $3)
       order by coalesce(c.name, c.title)`,
      [learner.school_id, profileId, termId]
    ),
    query(
      `select coalesce(c.name, c.title) as course_name, c.id as course_id,
              m.title as module_name, l.title as lesson_name, lp.score, lp.completed_at, lp.updated_at
       from lesson_progress lp
       join courses c on c.id = lp.course_id
       join modules m on m.id = lp.module_id
       join lessons l on l.id = lp.lesson_id
       where lp.learner_id = $1
       order by lp.updated_at desc`,
      [learner.id]
    ),
    query(
      `select tr.id, tr.term_id, tr.wpm, tr.accuracy, tr.time_taken_seconds, tr.created_at, t.name as term_name, ay.year
       from typing_results tr
       join terms t on t.id = tr.term_id
       join academic_years ay on ay.id = t.academic_year_id
       where tr.school_id = $1 and tr.learner_id = $2 and ($3::uuid is null or tr.term_id = $3)
       order by tr.created_at desc`,
      [learner.school_id, learner.id, termId]
    ),
    query(
      `select qa.id, qa.term_id, qa.score, qa.time_taken_seconds, qa.created_at,
              q.title as quiz_title, t.name as term_name, ay.year
       from quiz_attempts qa
       left join quizzes q on q.id = qa.quiz_id
       join terms t on t.id = qa.term_id
       join academic_years ay on ay.id = t.academic_year_id
       where qa.school_id = $1 and qa.learner_id = $2 and ($3::uuid is null or qa.term_id = $3)
       order by qa.created_at desc`,
      [learner.school_id, learner.id, termId]
    ),
    query(
      `select rc.id, rc.term_id, rc.pdf_url, rc.snapshot, rc.teacher_remarks, rc.published_at, rc.created_at,
              t.name as term_name, ay.year
       from report_cards rc
       join terms t on t.id = rc.term_id
       join academic_years ay on ay.id = t.academic_year_id
       where rc.school_id = $1 and rc.learner_id = $2 and ($3::uuid is null or rc.term_id = $3)
       order by ay.year desc, t.starts_on desc`,
      [learner.school_id, learner.id, termId]
    ),
    query(
      `select le.id, le.term_id, le.leaderboard_type, le.score, le.rank, le.created_at
       from leaderboard_entries le
       where le.school_id = $1 and le.learner_id = $2 and ($3::uuid is null or le.term_id = $3)
       order by le.leaderboard_type, le.rank`,
      [learner.school_id, learner.id, termId]
    ),
    query(
      `select s.id, s.term_id, s.file_url, s.status, s.feedback, s.reviewed_at, s.created_at, l.title as lesson_title
       from submissions s
       left join lessons l on l.id = s.lesson_id
       where s.school_id = $1 and s.learner_id = $2 and ($3::uuid is null or s.term_id = $3)
       order by s.created_at desc`,
      [learner.school_id, learner.id, termId]
    )
  ]);

  const courseScores = courses.rows.map((course) => {
    const rows = progress.rows.filter((item) => item.course_id === course.course_id);
    return {
      course_id: course.course_id,
      course_name: course.course_name,
      average_score: average(rows, "score"),
      lessons_completed: rows.filter((item) => item.completed_at).length,
      progress_records: rows.length
    };
  });

  return {
    learner,
    active_term: activeTerm,
    selected_term_id: termId,
    summary: {
      enrolled_courses: courses.rows.length,
      reports: reports.rows.length,
      badges: leaderboards.rows.length,
      average_course_score: average(courseScores, "average_score"),
      average_quiz_score: average(quizzes.rows, "score"),
      average_typing_wpm: average(typing.rows, "wpm"),
      average_typing_accuracy: average(typing.rows, "accuracy")
    },
    courses: courses.rows,
    course_performance: courseScores,
    lesson_progress: progress.rows,
    typing_results: typing.rows,
    quiz_results: quizzes.rows,
    reports: reports.rows,
    badges: leaderboards.rows,
    submissions: submissions.rows
  };
}

module.exports = {
  assertStudent,
  dashboard
};
