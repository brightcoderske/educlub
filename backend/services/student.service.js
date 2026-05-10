const { one, query } = require("../config/database");
const { recordAudit } = require("../utils/audit");

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

function expectation(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "-";
  if (value <= 50) return "Approaching expectation";
  if (value <= 80) return "Meets expectation";
  return "Exceeding expectation";
}

function rankRows(rows, scoreKey = "score") {
  let previousScore = null;
  let previousRank = 0;
  return rows.map((row, index) => {
    const score = Number(row[scoreKey] || 0);
    const rank = previousScore === score ? previousRank : index + 1;
    previousScore = score;
    previousRank = rank;
    return { ...row, score, rank };
  });
}

function typingMetrics(passage, typedText, elapsedSeconds) {
  const expected = String(passage || "");
  const typed = String(typedText || "");
  const seconds = Math.max(Number(elapsedSeconds || 0), 1);
  let correctCharacters = 0;
  for (let index = 0; index < typed.length; index += 1) {
    if (typed[index] === expected[index]) correctCharacters += 1;
  }
  const accuracy = typed.length ? (correctCharacters / typed.length) * 100 : 0;
  const wpm = (correctCharacters / 5) / (seconds / 60);
  return {
    wpm: Math.round(wpm * 100) / 100,
    accuracy: Math.round(accuracy * 100) / 100,
    timeTakenSeconds: Math.round(seconds)
  };
}

async function learnerContext(user) {
  assertStudent(user);
  const learner = await one(
    `select u.id, u.school_id, coalesce(u.full_name, u.name) as full_name, u.username, u.grade, u.stream,
            u.last_login_at, u.previous_login_at, s.name as school_name, s.logo_url as school_logo_url, lp.id as learner_profile_id
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
    `select t.id, coalesce(t.label, t.name::text) as name, t.starts_on, t.ends_on, ay.year
     from terms t
     join academic_years ay on ay.id = t.academic_year_id
     where t.is_global_active = true
     order by t.starts_on desc
     limit 1`
  );

  return { learner, activeTerm };
}

async function dashboard(user, params = {}) {
  const { learner, activeTerm } = await learnerContext(user);
  const termId = params.term_id || activeTerm?.id || null;
  const profileId = learner.learner_profile_id || null;

  const [courses, progress, typing, quizzes, reports, leaderboards, submissions, assignedQuizzes, assignedTypingTests, quizTrend, typingTrend, quizLeaders] = await Promise.all([
    query(
      `select e.id as enrolment_id, e.status, e.created_at, e.term_id,
              coalesce(c.name, c.title) as course_name, c.id as course_id, c.club, coalesce(c.objectives, c.description) as objectives,
              coalesce(t.label, t.name::text) as term_name, ay.year
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
      `select tr.id, tr.term_id, tr.wpm, tr.accuracy, tr.time_taken_seconds, tr.created_at, tt.title as test_title,
              coalesce(t.label, t.name::text) as term_name, ay.year
       from (
         select id, learner_id, school_id, term_id, wpm, accuracy, time_taken_seconds, created_at, null::uuid as typing_test_id
         from typing_results
         union all
         select id, learner_id, school_id, term_id, wpm, accuracy, time_taken_seconds, created_at, typing_test_id
         from typing_attempts
       ) tr
       left join typing_tests tt on tt.id = tr.typing_test_id
       join terms t on t.id = tr.term_id
       join academic_years ay on ay.id = t.academic_year_id
       where tr.school_id = $1 and tr.learner_id = $2 and ($3::uuid is null or tr.term_id = $3)
       order by tr.created_at desc`,
      [learner.school_id, learner.id, termId]
    ),
    query(
      `select qa.id, qa.term_id, qa.score, qa.time_taken_seconds, qa.created_at,
              q.title as quiz_title, coalesce(t.label, t.name::text) as term_name, ay.year
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
              coalesce(t.label, t.name::text) as term_name, ay.year
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
    ),
    query(
      `select qa.id as assignment_id, qa.quiz_id, qa.grade, qa.max_attempts, qa.assigned_at,
              qa.available_from, qa.available_until,
              q.title, q.description, q.grade_levels, q.total_points, q.time_limit_seconds,
              count(at.id)::int as attempts_used,
              max(at.score)::numeric as best_score
       from quiz_assignments qa
       join quizzes q on q.id = qa.quiz_id
       left join quiz_attempts at on at.assignment_id = qa.id and at.learner_id = $2
       where qa.school_id = $1 and qa.grade = $3 and qa.is_active = true
         and ($4::uuid is null or qa.term_id = $4)
         and (qa.available_from is null or qa.available_from <= now())
         and (qa.available_until is null or qa.available_until >= now())
         and q.deleted_at is null and q.is_published = true
       group by qa.id, q.id
       order by qa.assigned_at desc`,
      [learner.school_id, learner.id, Number(learner.grade), termId]
    ),
    query(
      `select ta.id as assignment_id, ta.typing_test_id, ta.grade, ta.assigned_at, ta.available_from, ta.available_until,
              tt.title, tt.duration_seconds, tt.grade_levels,
              count(at.id)::int as attempts_used,
              max(at.wpm)::numeric as best_wpm,
              max(at.accuracy)::numeric as best_accuracy
       from typing_assignments ta
       join typing_tests tt on tt.id = ta.typing_test_id
       left join typing_attempts at on at.assignment_id = ta.id and at.learner_id = $2
       where ta.school_id = $1 and ta.grade = $3 and ta.is_active = true
         and ($4::uuid is null or ta.term_id = $4)
         and (ta.available_from is null or ta.available_from <= now())
         and (ta.available_until is null or ta.available_until >= now())
         and tt.deleted_at is null and tt.is_published = true
       group by ta.id, tt.id
       order by ta.assigned_at desc`,
      [learner.school_id, learner.id, Number(learner.grade), termId]
    ),
    query(
      `select date_trunc('week', qa.created_at)::date as week_start,
              max(qa.score)::numeric as best_score,
              avg(qa.score)::numeric as average_score,
              count(*)::int as attempts
       from quiz_attempts qa
       where qa.school_id = $1 and qa.learner_id = $2 and ($3::uuid is null or qa.term_id = $3)
       group by date_trunc('week', qa.created_at)::date
       order by week_start`,
      [learner.school_id, learner.id, termId]
    ),
    query(
      `select date_trunc('week', ta.created_at)::date as week_start,
              max(ta.wpm)::numeric as best_wpm,
              avg(ta.wpm)::numeric as average_wpm,
              avg(ta.accuracy)::numeric as average_accuracy,
              count(*)::int as attempts
       from typing_attempts ta
       where ta.school_id = $1 and ta.learner_id = $2 and ($3::uuid is null or ta.term_id = $3)
       group by date_trunc('week', ta.created_at)::date
       order by week_start`,
      [learner.school_id, learner.id, termId]
    ),
    query(
      `select qa.learner_id, coalesce(u.full_name, u.name) as learner_name, u.grade, u.stream,
              max(qa.score)::numeric as best_score,
              avg(qa.score)::numeric as average_score,
              count(*)::int as attempts,
              max(qa.created_at) as created_at
       from quiz_attempts qa
       join users u on u.id = qa.learner_id
       where qa.school_id = $1 and ($2::uuid is null or qa.term_id = $2)
       group by qa.learner_id, coalesce(u.full_name, u.name), u.grade, u.stream
       order by max(qa.score) desc, avg(qa.score) desc, max(qa.created_at) asc`,
      [learner.school_id, termId]
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

  const dynamicQuizLeaderboard = rankRows(quizLeaders.rows.map((row) => ({
    id: `quiz-${termId || "all"}-${row.learner_id}`,
    term_id: termId,
    leaderboard_type: "quiz",
    score: row.best_score,
    average_score: row.average_score,
    attempts: row.attempts,
    learner_id: row.learner_id,
    learner_name: row.learner_name,
    grade: row.grade,
    stream: row.stream,
    created_at: row.created_at
  }))).filter((row) => row.learner_id === learner.id);

  const leaderboardRows = [
    ...leaderboards.rows,
    ...dynamicQuizLeaderboard.filter((row) => !leaderboards.rows.some((entry) => entry.leaderboard_type === "quiz"))
  ];

  const reportCard = {
    learner,
    school: {
      id: learner.school_id,
      name: learner.school_name,
      logo_url: learner.school_logo_url
    },
    term: activeTerm,
    courses: courses.rows,
    quiz_results: quizzes.rows,
    typing_results: typing.rows,
    leaderboards: leaderboardRows,
    summary: {
      courses: courses.rows.length,
      quiz_attempts: quizzes.rows.length,
      quiz_average: average(quizzes.rows, "score"),
      typing_average_wpm: average(typing.rows, "wpm"),
      typing_average_accuracy: average(typing.rows, "accuracy")
    }
  };

  return {
    learner,
    active_term: activeTerm,
    selected_term_id: termId,
    summary: {
      enrolled_courses: courses.rows.length,
      reports: reports.rows.length,
      badges: leaderboardRows.length,
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
    assigned_quizzes: assignedQuizzes.rows.map((row) => ({
      ...row,
      can_attempt: Number(row.attempts_used) < Number(row.max_attempts),
      expectation: expectation(row.best_score)
    })),
    assigned_typing_tests: assignedTypingTests.rows,
    weekly_quiz_trend: quizTrend.rows,
    weekly_typing_trend: typingTrend.rows,
    reports: reports.rows,
    report_card: reportCard,
    badges: leaderboardRows,
    submissions: submissions.rows
  };
}

async function quizForTaking(user, quizId) {
  const { learner, activeTerm } = await learnerContext(user);
  const termId = activeTerm?.id || null;
  const assignment = await one(
    `select qa.id, qa.max_attempts, qa.term_id, q.id as quiz_id, q.title, q.description, q.time_limit_seconds,
            q.randomise_order, q.total_points
     from quiz_assignments qa
     join quizzes q on q.id = qa.quiz_id
     where qa.school_id = $1 and qa.quiz_id = $2 and qa.grade = $3 and qa.is_active = true
       and ($4::uuid is null or qa.term_id = $4)
       and (qa.available_from is null or qa.available_from <= now())
       and (qa.available_until is null or qa.available_until >= now())
       and q.deleted_at is null and q.is_published = true`,
    [learner.school_id, quizId, Number(learner.grade), termId]
  );
  if (!assignment) {
    const error = new Error("Quiz is not assigned to your grade");
    error.statusCode = 404;
    throw error;
  }
  const attempts = await one(
    "select count(*)::int as count from quiz_attempts where assignment_id = $1 and learner_id = $2",
    [assignment.id, learner.id]
  );
  if (attempts.count >= assignment.max_attempts) {
    const error = new Error("You have used all attempts for this quiz");
    error.statusCode = 400;
    throw error;
  }
  const questions = await query(
    `select qq.id, qq.question, qq.option_a, qq.option_b, qq.option_c, qq.option_d, qi.sort_order
     from quiz_items qi
     join quiz_questions qq on qq.id = qi.question_id
     where qi.quiz_id = $1 and qq.deleted_at is null
     order by qi.sort_order`,
    [quizId]
  );
  return {
    ...assignment,
    attempts_used: attempts.count,
    questions: questions.rows
  };
}

async function submitQuizAttempt(user, quizId, payload = {}) {
  const { learner, activeTerm } = await learnerContext(user);
  const termId = activeTerm?.id || null;
  const assignment = await one(
    `select qa.id, qa.max_attempts, qa.term_id, q.id as quiz_id, q.total_points
     from quiz_assignments qa
     join quizzes q on q.id = qa.quiz_id
     where qa.school_id = $1 and qa.quiz_id = $2 and qa.grade = $3 and qa.is_active = true
       and ($4::uuid is null or qa.term_id = $4)
       and (qa.available_from is null or qa.available_from <= now())
       and (qa.available_until is null or qa.available_until >= now())
       and q.deleted_at is null and q.is_published = true`,
    [learner.school_id, quizId, Number(learner.grade), termId]
  );
  if (!assignment) {
    const error = new Error("Quiz is not assigned to your grade");
    error.statusCode = 404;
    throw error;
  }
  const attempts = await one(
    "select count(*)::int as count from quiz_attempts where assignment_id = $1 and learner_id = $2",
    [assignment.id, learner.id]
  );
  if (attempts.count >= assignment.max_attempts) {
    const error = new Error("You have used all attempts for this quiz");
    error.statusCode = 400;
    throw error;
  }
  const questions = await query(
    `select qq.id, qq.correct_option
     from quiz_items qi
     join quiz_questions qq on qq.id = qi.question_id
     where qi.quiz_id = $1 and qq.deleted_at is null`,
    [quizId]
  );
  const answers = payload.answers || {};
  const total = questions.rows.length;
  if (!total) {
    const error = new Error("This quiz has no questions yet");
    error.statusCode = 400;
    throw error;
  }
  const correct = questions.rows.filter((question) => {
    return String(answers[question.id] || "").trim().toUpperCase() === String(question.correct_option || "").trim().toUpperCase();
  }).length;
  const score = Math.round((correct / total) * 10000) / 100;
  const saved = await one(
    `insert into quiz_attempts (
       quiz_id, learner_id, school_id, term_id, score, time_taken_seconds, assignment_id, attempt_number, answers
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id, quiz_id, score, attempt_number, created_at`,
    [
      quizId,
      learner.id,
      learner.school_id,
      assignment.term_id || termId,
      score,
      payload.time_taken_seconds ? Number(payload.time_taken_seconds) : null,
      assignment.id,
      attempts.count + 1,
      answers
    ]
  );
  await recordAudit({
    actor: user,
    action: "quiz.attempt_submit",
    targetType: "quiz",
    targetId: quizId,
    schoolId: learner.school_id,
    termId: assignment.term_id || termId,
    metadata: { learner_id: learner.id, score, attempt_number: saved.attempt_number }
  });
  return {
    ...saved,
    correct,
    total,
    expectation: expectation(score)
  };
}

async function typingTestForTaking(user, testId) {
  const { learner, activeTerm } = await learnerContext(user);
  const termId = activeTerm?.id || null;
  const assignment = await one(
    `select ta.id, ta.term_id, ta.available_from, ta.available_until,
            tt.id as typing_test_id, tt.title, tt.passage, tt.duration_seconds
     from typing_assignments ta
     join typing_tests tt on tt.id = ta.typing_test_id
     where ta.school_id = $1 and ta.typing_test_id = $2 and ta.grade = $3 and ta.is_active = true
       and ($4::uuid is null or ta.term_id = $4)
       and (ta.available_from is null or ta.available_from <= now())
       and (ta.available_until is null or ta.available_until >= now())
       and tt.deleted_at is null and tt.is_published = true`,
    [learner.school_id, testId, Number(learner.grade), termId]
  );
  if (!assignment) {
    const error = new Error("Typing test is not currently assigned to your grade");
    error.statusCode = 404;
    throw error;
  }
  const best = await one(
    `select max(wpm)::numeric as best_wpm, max(accuracy)::numeric as best_accuracy, count(*)::int as attempts
     from typing_attempts
     where assignment_id = $1 and learner_id = $2`,
    [assignment.id, learner.id]
  );
  return {
    ...assignment,
    attempts_used: best?.attempts || 0,
    best_wpm: best?.best_wpm || null,
    best_accuracy: best?.best_accuracy || null
  };
}

async function submitTypingAttempt(user, testId, payload = {}) {
  const { learner, activeTerm } = await learnerContext(user);
  const termId = activeTerm?.id || null;
  const assignment = await one(
    `select ta.id, ta.term_id, tt.id as typing_test_id, tt.title, tt.passage
     from typing_assignments ta
     join typing_tests tt on tt.id = ta.typing_test_id
     where ta.school_id = $1 and ta.typing_test_id = $2 and ta.grade = $3 and ta.is_active = true
       and ($4::uuid is null or ta.term_id = $4)
       and (ta.available_from is null or ta.available_from <= now())
       and (ta.available_until is null or ta.available_until >= now())
       and tt.deleted_at is null and tt.is_published = true`,
    [learner.school_id, testId, Number(learner.grade), termId]
  );
  if (!assignment) {
    const error = new Error("Typing test is not currently assigned to your grade");
    error.statusCode = 404;
    throw error;
  }
  const typedText = String(payload.typed_text || "");
  const metrics = typingMetrics(assignment.passage, typedText, payload.time_taken_seconds);
  const saved = await one(
    `insert into typing_attempts (
       typing_test_id, assignment_id, learner_id, school_id, term_id, wpm, accuracy, time_taken_seconds, typed_text
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id, typing_test_id, wpm, accuracy, time_taken_seconds, created_at`,
    [
      assignment.typing_test_id,
      assignment.id,
      learner.id,
      learner.school_id,
      assignment.term_id || termId,
      metrics.wpm,
      metrics.accuracy,
      metrics.timeTakenSeconds,
      typedText
    ]
  );
  await recordAudit({
    actor: user,
    action: "typing.attempt_submit",
    targetType: "typing_test",
    targetId: assignment.typing_test_id,
    schoolId: learner.school_id,
    termId: assignment.term_id || termId,
    metadata: { learner_id: learner.id, wpm: saved.wpm, accuracy: saved.accuracy }
  });
  return saved;
}

module.exports = {
  assertStudent,
  dashboard,
  quizForTaking,
  submitQuizAttempt,
  typingTestForTaking,
  submitTypingAttempt
};
