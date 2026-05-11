const { one, query } = require("../config/database");
const { recordAudit } = require("../utils/audit");
const { ensureTypingColumns, ensureCourseBuilderSchema } = require("../utils/schemaGuard");

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

function parseJsonObject(value, fallback = {}) {
  if (!value) return { ...fallback };
  if (typeof value === "object") return { ...fallback, ...value };
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed ? { ...fallback, ...parsed } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function inferPracticeLanguage(technology) {
  const t = String(technology || "").toLowerCase();
  if (t === "python") return "python";
  if (t === "web") return "html";
  if (t === "android" || t === "arduino" || t === "scratch" || t === "robotics") return "text";
  if (t === "computer_basics") return "html";
  return "html";
}

function blockStepTitle(activityType, payload, index) {
  const p = parseJsonObject(payload);
  if (p.title) return String(p.title);
  const labels = {
    learn_content: "Learn",
    practice: "Practice",
    creative_corner: "Creative corner",
    teacher_task: "Class task",
    quiz: "Quiz check",
    submission: "Submit your work"
  };
  return labels[activityType] || `Activity ${index + 1}`;
}

function buildPlayerSteps(lesson, blocks, courseTechnology) {
  const sortedBlocks = Array.isArray(blocks) ? [...blocks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : [];
  if (sortedBlocks.length) {
    return sortedBlocks.map((b, idx) => ({
      step_id: b.id,
      source: "block",
      activity_type: b.activity_type,
      title: blockStepTitle(b.activity_type, b.payload, idx),
      marks_weight: Number(b.marks_weight || 0),
      payload: parseJsonObject(b.payload),
      sort_order: Number(b.sort_order || idx + 1)
    }));
  }
  const steps = [];
  let order = 1;
  const learnText = lesson.learning_notes || lesson.content || "";
  if (String(learnText).trim()) {
    steps.push({
      step_id: "legacy:learn",
      source: "legacy",
      activity_type: "learn_content",
      title: "Learn",
      marks_weight: null,
      payload: { richText: learnText, images: [], videoUrls: [], codeExample: lesson.example || "", teacherNotes: "" },
      sort_order: order++
    });
  }
  if (lesson.practice_prompt || lesson.starter_code || lesson.example) {
    steps.push({
      step_id: "legacy:practice",
      source: "legacy",
      activity_type: "practice",
      title: "Practice",
      marks_weight: null,
      payload: {
        language: inferPracticeLanguage(courseTechnology),
        instructions: lesson.practice_prompt || "",
        starterCode: String(lesson.starter_code || lesson.example || ""),
        expectedHints: ""
      },
      sort_order: order++
    });
  }
  if (lesson.homework_prompt) {
    steps.push({
      step_id: "legacy:homework",
      source: "legacy",
      activity_type: "submission",
      title: "Home task",
      marks_weight: null,
      payload: {
        instructions: lesson.homework_prompt,
        allowCode: true,
        allowText: true,
        allowFile: false,
        allowLink: false,
        allowScreenshot: false
      },
      sort_order: order++
    });
  }
  if (lesson.creativity_prompt) {
    steps.push({
      step_id: "legacy:creativity",
      source: "legacy",
      activity_type: "creative_corner",
      title: "Creative corner",
      marks_weight: null,
      payload: { instructions: lesson.creativity_prompt },
      sort_order: order++
    });
  }
  const quizQuestions = Array.isArray(lesson.quiz) ? lesson.quiz : [];
  if (quizQuestions.length) {
    steps.push({
      step_id: "legacy:quiz",
      source: "legacy",
      activity_type: "quiz",
      title: "Quiz",
      marks_weight: null,
      payload: { questions: quizQuestions },
      sort_order: order++
    });
  }
  return steps;
}

function expectedQuizAnswer(question) {
  if (!question) return "";
  if (question.answer != null && question.answer !== "") return String(question.answer).trim();
  if (Array.isArray(question.options) && question.correctIndex != null) {
    return String(question.options[Number(question.correctIndex)] || "").trim();
  }
  return "";
}

function scoreQuizQuestions(questions, answers) {
  if (!Array.isArray(questions) || !questions.length) return null;
  const map = answers && typeof answers === "object" ? answers : {};
  let correct = 0;
  questions.forEach((question, index) => {
    const given = map[index] ?? map[String(index)];
    if (String(given || "").trim() === expectedQuizAnswer(question)) {
      correct += 1;
    }
  });
  return Math.round((correct / questions.length) * 10000) / 100;
}

function typingMetrics(passage, typedText, elapsedSeconds) {
  const expected = String(passage || "");
  const typed = String(typedText || "").slice(0, expected.length);
  const seconds = Math.max(Number(elapsedSeconds || 0), 1);
  let correctCharacters = 0;
  for (let index = 0; index < typed.length; index += 1) {
    if (typed[index] === expected[index]) correctCharacters += 1;
  }
  const accuracy = typed.length ? (correctCharacters / typed.length) * 100 : 0;
  const wpm = Math.min((correctCharacters / 5) / (seconds / 60), 250);
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
  const enrolmentLearnerIds = [learner.id, learner.learner_profile_id].filter(Boolean);

  const [courses, progress, typing, quizzes, reports, leaderboards, submissions, assignedQuizzes, assignedTypingTests, quizTrend, typingTrend, quizLeaders, typingLeaders] = await Promise.all([
    query(
      `select e.id as enrolment_id, e.status, e.created_at, e.term_id,
              coalesce(c.name, c.title) as course_name, c.id as course_id, c.club, coalesce(c.objectives, c.description) as objectives,
              coalesce(t.label, t.name::text) as term_name, ay.year
       from enrolments e
       join courses c on c.id = e.course_id
       join terms t on t.id = e.term_id
       join academic_years ay on ay.id = t.academic_year_id
       where e.school_id = $1 and e.learner_id = any($2::uuid[]) and ($3::uuid is null or e.term_id = $3)
       order by coalesce(c.name, c.title)`,
      [learner.school_id, enrolmentLearnerIds, termId]
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
              tt.title, tt.duration_seconds, tt.grade_levels, tt.max_attempts,
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
    ),
    query(
      `select ts.learner_id, coalesce(u.full_name, u.name) as learner_name, u.grade, u.stream,
              ts.best_wpm, ts.best_accuracy, ts.attempts, ts.created_at
       from (
         select best.learner_id, best.school_id, best.term_id,
                best.wpm::numeric as best_wpm,
                best.accuracy::numeric as best_accuracy,
                counts.attempts,
                best.created_at
         from (
           select distinct on (learner_id, school_id, term_id)
                  learner_id, school_id, term_id, wpm, accuracy, created_at
           from (
             select learner_id, school_id, term_id, wpm, accuracy, created_at from typing_results
             union all
             select learner_id, school_id, term_id, wpm, accuracy, created_at from typing_attempts
           ) typing_source
           where school_id = $1 and ($2::uuid is null or term_id = $2)
           order by learner_id, school_id, term_id, wpm desc, accuracy desc, created_at asc
         ) best
         join (
           select learner_id, school_id, term_id, count(*)::int as attempts
           from (
             select learner_id, school_id, term_id from typing_results
             union all
             select learner_id, school_id, term_id from typing_attempts
           ) typing_source
           where school_id = $1 and ($2::uuid is null or term_id = $2)
           group by learner_id, school_id, term_id
         ) counts on counts.learner_id = best.learner_id and counts.school_id = best.school_id and counts.term_id = best.term_id
       ) ts
       join users u on u.id = ts.learner_id
       order by ts.best_wpm desc, ts.best_accuracy desc, ts.created_at asc`,
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

  const dynamicTypingLeaderboard = rankRows(typingLeaders.rows.map((row) => ({
    id: `typing-${termId || "all"}-${row.learner_id}`,
    term_id: termId,
    leaderboard_type: "typing",
    score: row.best_wpm,
    best_accuracy: row.best_accuracy,
    attempts: row.attempts,
    learner_id: row.learner_id,
    learner_name: row.learner_name,
    grade: row.grade,
    stream: row.stream,
    created_at: row.created_at
  }))).filter((row) => row.learner_id === learner.id);

  const leaderboardRows = [
    ...leaderboards.rows,
    ...dynamicQuizLeaderboard.filter((row) => !leaderboards.rows.some((entry) => entry.leaderboard_type === "quiz")),
    ...dynamicTypingLeaderboard.filter((row) => !leaderboards.rows.some((entry) => entry.leaderboard_type === "typing"))
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
  await ensureTypingColumns({ query });
  const { learner, activeTerm } = await learnerContext(user);
  const termId = activeTerm?.id || null;
  const assignment = await one(
    `select ta.id, ta.term_id, ta.available_from, ta.available_until,
            tt.id as typing_test_id, tt.title, tt.passage, tt.duration_seconds, tt.max_attempts
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
  await ensureTypingColumns({ query });
  const { learner, activeTerm } = await learnerContext(user);
  const termId = activeTerm?.id || null;
  const assignment = await one(
    `select ta.id, ta.term_id, tt.id as typing_test_id, tt.title, tt.passage, tt.duration_seconds, tt.max_attempts
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
  const attempts = await one(
    "select count(*)::int as count from typing_attempts where assignment_id = $1 and learner_id = $2",
    [assignment.id, learner.id]
  );
  if (attempts.count >= Number(assignment.max_attempts || 3)) {
    const error = new Error("You have used all attempts for this typing test");
    error.statusCode = 400;
    throw error;
  }
  const expected = String(assignment.passage || "");
  const typedText = String(payload.typed_text || "").slice(0, expected.length);
  const requestedSeconds = Number(payload.time_taken_seconds || 0);
  const durationSeconds = Math.max(Number(assignment.duration_seconds || 300), 1);
  const fastestAllowedSeconds = Math.ceil((typedText.length / 5 / 250) * 60);
  const elapsedSeconds = Math.min(
    Math.max(requestedSeconds || durationSeconds, fastestAllowedSeconds, 1),
    durationSeconds
  );
  const metrics = typingMetrics(expected, typedText, elapsedSeconds);
  const saved = await one(
    `insert into typing_attempts (
       typing_test_id, assignment_id, learner_id, school_id, term_id, wpm, accuracy, time_taken_seconds, typed_text, raw_answer
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      typedText,
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

async function courseForLearning(user, courseId) {
  await ensureCourseBuilderSchema({ query });
  const { learner, activeTerm } = await learnerContext(user);
  const termId = activeTerm?.id || null;
  const enrolmentLearnerIds = [learner.id, learner.learner_profile_id].filter(Boolean);
  const enrolment = await one(
    `select e.id, e.course_id, c.name, c.title, c.objectives, c.description, c.is_coming_soon, c.technology
     from enrolments e
     join courses c on c.id = e.course_id
     where e.school_id = $1 and e.learner_id = any($2::uuid[]) and e.course_id = $3
       and ($4::uuid is null or e.term_id = $4) and e.status = 'active'`,
    [learner.school_id, enrolmentLearnerIds, courseId, termId]
  );
  if (!enrolment) {
    const error = new Error("Course is not allocated to you for this term");
    error.statusCode = 404;
    throw error;
  }
  const courseTechnology = enrolment.technology || null;
  const modules = await query(
    `select m.id, m.course_id, coalesce(m.name, m.title) as name, coalesce(m.objectives, m.description) as objectives, m.sort_order, m.badge_name, m.xp_points,
            coalesce(cma.available_from, m.available_from) as available_from
     from modules m
     left join course_module_availability cma on cma.module_id = m.id and cma.school_id = $2
     where m.course_id = $1
     order by m.sort_order`,
    [courseId, learner.school_id]
  );
  const lessons = await query(
    `select l.id, l.module_id, coalesce(l.name, l.title) as name,
            coalesce(l.learning_notes, l.description, l.content->>'notes') as content,
            l.example,
            coalesce(l.learning_notes, l.description, l.content->>'notes') as learning_notes,
            l.lesson_objectives,
            l.practice_prompt,
            l.starter_code, l.homework_prompt, l.creativity_prompt, l.quiz, l.xp_points, l.sort_order,
            lp.score, lp.completed_at, lp.practice_code, lp.homework_code, lp.creativity_code, lp.quiz_answers, lp.xp_points as earned_xp,
            lp.activity_progress, lp.score_breakdown
     from lessons l
     join modules m on m.id = l.module_id
     left join lesson_progress lp on lp.lesson_id = l.id and lp.learner_id = $2
     where m.course_id = $1
     order by m.sort_order, l.sort_order`,
    [courseId, learner.id]
  );
  const lessonIds = lessons.rows.map((l) => l.id);
  let blockRows = { rows: [] };
  if (lessonIds.length) {
    blockRows = await query(
      `select id, lesson_id, activity_type, sort_order, marks_weight, payload
       from lesson_activity_blocks
       where lesson_id = any($1::uuid[])
       order by lesson_id, sort_order, created_at`,
      [lessonIds]
    );
  }
  const blocksByLesson = {};
  for (const row of blockRows.rows) {
    if (!blocksByLesson[row.lesson_id]) blocksByLesson[row.lesson_id] = [];
    blocksByLesson[row.lesson_id].push(row);
  }
  const shapedLessons = lessons.rows.map((lesson) => {
    const blocks = blocksByLesson[lesson.id] || [];
    const player_steps = buildPlayerSteps(lesson, blocks, courseTechnology);
    return {
      ...lesson,
      activity_progress: parseJsonObject(lesson.activity_progress),
      score_breakdown: parseJsonObject(lesson.score_breakdown),
      player_steps,
      player_step_count: player_steps.length
    };
  });
  return {
    id: enrolment.course_id,
    name: enrolment.name || enrolment.title,
    objectives: enrolment.objectives || enrolment.description,
    is_coming_soon: enrolment.is_coming_soon,
    technology: courseTechnology,
    modules: modules.rows.map((module) => ({
      ...module,
      is_locked: module.available_from ? new Date(module.available_from) > new Date() : false,
      lessons: shapedLessons.filter((lesson) => lesson.module_id === module.id)
    }))
  };
}

async function saveLessonProgress(user, lessonId, payload = {}) {
  await ensureCourseBuilderSchema({ query });
  const { learner, activeTerm } = await learnerContext(user);
  const termId = activeTerm?.id || null;
  const enrolmentLearnerIds = [learner.id, learner.learner_profile_id].filter(Boolean);
  const lesson = await one(
    `select l.id, l.module_id, l.quiz, l.xp_points, m.course_id
     from lessons l
     join modules m on m.id = l.module_id
     join enrolments e on e.course_id = m.course_id and e.school_id = $2 and e.learner_id = any($3::uuid[])
     where l.id = $1 and ($4::uuid is null or e.term_id = $4) and e.status = 'active'`,
    [lessonId, learner.school_id, enrolmentLearnerIds, termId]
  );
  if (!lesson) {
    const error = new Error("Lesson is not available to you");
    error.statusCode = 404;
    throw error;
  }
  const existing = await one(
    `select practice_code, homework_code, creativity_code, quiz_answers, activity_progress, score
     from lesson_progress where learner_id = $1 and lesson_id = $2`,
    [learner.id, lessonId]
  );
  const existingQuizAnswers = parseJsonObject(existing?.quiz_answers);
  const mergedActivity = {
    ...parseJsonObject(existing?.activity_progress),
    ...parseJsonObject(payload.activity_progress)
  };
  const practice_code =
    mergedActivity["legacy:practice"]?.code ??
    payload.practice_code ??
    existing?.practice_code ??
    "";
  const homework_code =
    mergedActivity["legacy:homework"]?.text ??
    payload.homework_code ??
    existing?.homework_code ??
    "";
  const creativity_code =
    mergedActivity["legacy:creativity"]?.text ??
    payload.creativity_code ??
    existing?.creativity_code ??
    "";
  const quizFromLegacyDraft =
    mergedActivity["legacy:quiz"]?.answers || payload.quiz_answers || existingQuizAnswers || {};
  const answers = typeof quizFromLegacyDraft === "object" && quizFromLegacyDraft ? quizFromLegacyDraft : {};

  mergedActivity["legacy:practice"] = { ...(mergedActivity["legacy:practice"] || {}), code: practice_code };
  mergedActivity["legacy:homework"] = { ...(mergedActivity["legacy:homework"] || {}), text: homework_code };
  mergedActivity["legacy:creativity"] = { ...(mergedActivity["legacy:creativity"] || {}), text: creativity_code };
  mergedActivity["legacy:quiz"] = { ...(mergedActivity["legacy:quiz"] || {}), answers };

  const blocks = await query(
    `select id, activity_type, payload from lesson_activity_blocks where lesson_id = $1 order by sort_order, created_at`,
    [lessonId]
  );
  const quizBlock = blocks.rows.find((b) => b.activity_type === "quiz");
  const blockQuizQuestions = quizBlock ? parseJsonObject(quizBlock.payload).questions : null;

  const legacyQuestions = Array.isArray(lesson.quiz) ? lesson.quiz : [];
  let score = payload.score === undefined || payload.score === null ? null : Number(payload.score);
  if (payload.submit_quiz) {
    if (legacyQuestions.length) {
      score = scoreQuizQuestions(legacyQuestions, answers);
    } else if (Array.isArray(blockQuizQuestions) && blockQuizQuestions.length && quizBlock) {
      const blockAnswers = mergedActivity[quizBlock.id]?.answers || mergedActivity[quizBlock.id]?.quiz_answers || {};
      score = scoreQuizQuestions(blockQuizQuestions, blockAnswers);
    }
  }

  const completed = Boolean(payload.completed || payload.submit_quiz || score !== null);
  const activityProgressJson = JSON.stringify(mergedActivity);

  const saved = await one(
    `insert into lesson_progress (
       learner_id, course_id, module_id, lesson_id, score, completed_at, practice_code,
       homework_code, creativity_code, quiz_answers, xp_points, activity_progress, updated_at
     )
     values ($1, $2, $3, $4, $5, case when $6 then now() else null end, $7, $8, $9, $10::jsonb, $11, $12::jsonb, now())
     on conflict (learner_id, lesson_id) do update set
       score = coalesce(excluded.score, lesson_progress.score),
       completed_at = coalesce(excluded.completed_at, lesson_progress.completed_at),
       practice_code = excluded.practice_code,
       homework_code = excluded.homework_code,
       creativity_code = excluded.creativity_code,
       quiz_answers = excluded.quiz_answers,
       xp_points = greatest(lesson_progress.xp_points, excluded.xp_points),
       activity_progress = excluded.activity_progress,
       updated_at = now()
     returning id, score, completed_at, practice_code, homework_code, creativity_code, quiz_answers, xp_points, activity_progress`,
    [
      learner.id,
      lesson.course_id,
      lesson.module_id,
      lesson.id,
      score,
      completed,
      practice_code,
      homework_code,
      creativity_code,
      answers,
      completed ? Number(lesson.xp_points || 20) : 0,
      activityProgressJson
    ]
  );

  return { ...saved, activity_progress: parseJsonObject(saved.activity_progress) };
}

module.exports = {
  assertStudent,
  dashboard,
  quizForTaking,
  submitQuizAttempt,
  typingTestForTaking,
  submitTypingAttempt,
  courseForLearning,
  saveLessonProgress
};
