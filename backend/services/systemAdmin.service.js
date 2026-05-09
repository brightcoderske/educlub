const bcrypt = require("bcryptjs");
const { one, list, query, pagination, transaction } = require("../config/database");

const SYSTEM_ADMIN = "system_admin";

function assertSystemAdmin(user) {
  if (!user || user.role !== SYSTEM_ADMIN) {
    const error = new Error("System Admin access required");
    error.statusCode = 403;
    throw error;
  }
}

function like(value) {
  return `%${value}%`;
}

function normalizeGrades(grades) {
  const values = Array.isArray(grades) ? grades : String(grades || "").split(",");
  const normalized = [...new Set(values.map((grade) => Number(grade)).filter((grade) => Number.isInteger(grade) && grade >= 1 && grade <= 9))];
  if (!normalized.length) {
    const error = new Error("Select at least one grade from 1 to 9");
    error.statusCode = 400;
    throw error;
  }
  return normalized.sort((a, b) => a - b);
}

function normalizeCorrectOption(value) {
  const option = String(value || "").trim().toUpperCase();
  if (!["A", "B", "C", "D"].includes(option)) {
    const error = new Error("Correct option must be A, B, C, or D");
    error.statusCode = 400;
    throw error;
  }
  return option;
}

async function listSchools(params = {}) {
  const { limit, offset } = pagination(params);
  const values = [];
  const where = ["deleted_at is null"];

  if (params.search) {
    values.push(like(params.search));
    where.push(`name ilike $${values.length}`);
  }

  values.push(limit, offset);
  return list(
    `select id, name, contact_email, logo_url, clubs, is_active, suspended_at, deleted_at, created_at
     from schools where ${where.join(" and ")}
     order by created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
    `select count(*) from schools where ${where.join(" and ")}`,
    values.slice(0, -2)
  );
}

async function createSchool(payload) {
  return one(
    `insert into schools (name, contact_email, logo_url, clubs)
     values ($1, $2, $3, $4)
     returning *`,
    [payload.name, payload.contact_email || null, payload.logo_url || null, payload.clubs || []]
  );
}

async function getSchoolDetail(id) {
  const school = await one(
    `select id, name, contact_email, logo_url, clubs, is_active, suspended_at, deleted_at, created_at
     from schools
     where id = $1 and deleted_at is null`,
    [id]
  );

  if (!school) {
    const error = new Error("School not found");
    error.statusCode = 404;
    throw error;
  }

  const [admins, learners, counts] = await Promise.all([
    listUsers({ school_id: id, role: "school_admin", pageSize: 100 }),
    listUsers({ school_id: id, role: "student", pageSize: 100 }),
    one(
      `select
        (select count(*)::int from users where school_id = $1 and role = 'school_admin' and deleted_at is null) as school_admins,
        (select count(*)::int from users where school_id = $1 and role = 'student' and deleted_at is null) as learners,
        (select count(*)::int from enrolments where school_id = $1) as enrolments,
        (select count(*)::int from report_cards where school_id = $1) as report_cards,
        (select count(*)::int from submissions where school_id = $1) as submissions`,
      [id]
    )
  ]);

  return {
    school,
    counts,
    admins: admins.data,
    learners: learners.data
  };
}

async function updateSchool(id, payload) {
  return one(
    `update schools set name = $2, contact_email = $3, logo_url = $4, clubs = $5, updated_at = now()
     where id = $1 returning *`,
    [id, payload.name, payload.contact_email || null, payload.logo_url || null, payload.clubs || []]
  );
}

async function suspendSchool(id, suspended = true) {
  return one(
    `update schools set is_active = $2, suspended_at = $3, updated_at = now()
     where id = $1 returning *`,
    [id, !suspended, suspended ? new Date().toISOString() : null]
  );
}

async function softDeleteSchool(id) {
  return one(
    `update schools set deleted_at = now(), is_active = false, updated_at = now()
     where id = $1 returning *`,
    [id]
  );
}

async function deleteSchoolPermanently(id) {
  const existing = await one("select id, name from schools where id = $1", [id]);
  if (!existing) {
    const error = new Error("School not found");
    error.statusCode = 404;
    throw error;
  }

  return transaction(async (client) => {
    await client.query("delete from audit_logs where school_id = $1", [id]);
    await client.query("delete from leaderboard_entries where school_id = $1", [id]);
    await client.query("delete from report_cards where school_id = $1", [id]);
    await client.query("delete from submissions where school_id = $1", [id]);
    await client.query("delete from typing_results where school_id = $1", [id]);
    await client.query("delete from quiz_attempts where school_id = $1", [id]);
    await client.query("delete from quiz_question_school_visibility where school_id = $1", [id]);
    await client.query("delete from quiz_items where quiz_id in (select id from quizzes where school_id = $1)", [id]);
    await client.query("delete from quizzes where school_id = $1", [id]);
    await client.query("delete from quiz_questions where school_id = $1", [id]);
    await client.query("delete from school_lesson_annotations where school_id = $1", [id]);
    await client.query("delete from enrolments where school_id = $1", [id]);
    await client.query("delete from grade_history where school_id = $1", [id]);
    await client.query("delete from school_streams where school_id = $1", [id]);
    await client.query("delete from school_preferences where school_id = $1", [id]);
    await client.query("delete from school_active_terms where school_id = $1", [id]);
    await client.query("delete from users where school_id = $1", [id]);
    const deleted = await client.query("delete from schools where id = $1 returning id, name", [id]);
    return deleted.rows[0];
  });
}

async function listTerms(params = {}) {
  const { limit, offset } = pagination(params);
  const values = [];
  const where = ["true"];
  if (params.academic_year_id) {
    values.push(params.academic_year_id);
    where.push(`t.academic_year_id = $${values.length}`);
  }
  values.push(limit, offset);
  return list(
    `select t.id, t.academic_year_id, t.name, t.starts_on, t.ends_on, t.is_global_active, t.created_at, ay.year
     from terms t join academic_years ay on ay.id = t.academic_year_id
     where ${where.join(" and ")}
     order by t.starts_on desc limit $${values.length - 1} offset $${values.length}`,
    values,
    `select count(*) from terms t where ${where.join(" and ")}`,
    values.slice(0, -2)
  );
}

async function createAcademicYear(payload) {
  return one("insert into academic_years (year) values ($1) returning *", [payload.year]);
}

async function createTerm(payload) {
  return one(
    `insert into terms (academic_year_id, name, starts_on, ends_on)
     values ($1, $2, $3, $4) returning *`,
    [payload.academic_year_id, payload.name, payload.starts_on, payload.ends_on]
  );
}

async function setGlobalActiveTerm(termId) {
  return transaction(async (client) => {
    await client.query("update terms set is_global_active = false");
    const result = await client.query("update terms set is_global_active = true where id = $1 returning *", [termId]);
    return result.rows[0];
  });
}

async function listUsers(params = {}) {
  const { limit, offset } = pagination(params);
  const values = [];
  const where = ["u.deleted_at is null"];
  if (params.school_id) {
    values.push(params.school_id);
    where.push(`u.school_id = $${values.length}`);
  }
  if (params.role) {
    values.push(params.role);
    where.push(`u.role = $${values.length}`);
  }
  if (params.search) {
    values.push(like(params.search));
    where.push(`(u.full_name ilike $${values.length} or u.email ilike $${values.length} or u.username ilike $${values.length})`);
  }
  values.push(limit, offset);
  return list(
    `select u.id, u.school_id, u.role, coalesce(u.full_name, u.name) as full_name, u.email, u.username, u.grade, u.stream, u.is_active,
            u.deleted_at, u.created_at, s.name as school_name
     from users u left join schools s on s.id = u.school_id
     where ${where.join(" and ")}
     order by u.created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
    `select count(*) from users u where ${where.join(" and ")}`,
    values.slice(0, -2)
  );
}

async function createSchoolAdmin(payload) {
  const school = await one("select id from schools where id = $1 and deleted_at is null", [payload.school_id]);
  if (!school) {
    const error = new Error("A real school must be selected before creating a School Admin");
    error.statusCode = 400;
    throw error;
  }
  if (!payload.password) {
    const error = new Error("A temporary password is required");
    error.statusCode = 400;
    throw error;
  }
  const passwordHash = await bcrypt.hash(payload.password, 12);
  return one(
    `insert into users (school_id, role, name, full_name, email, password_hash, must_change_password, force_password_change, two_factor_enabled, status, is_active)
     values ($1, 'school_admin', $2, $2, lower($3), $4, true, true, false, 'active', true)
     returning id, school_id, role, full_name, email, is_active, created_at`,
    [payload.school_id, payload.full_name, payload.email, passwordHash]
  );
}

async function resetSchoolAdminPassword(schoolId, adminId, password) {
  if (!password) {
    const error = new Error("New temporary password is required");
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await one(
    `update users
     set password_hash = $3,
         force_password_change = true,
         is_active = true,
         updated_at = now()
     where id = $1 and school_id = $2 and role = 'school_admin' and deleted_at is null
     returning id, full_name, email, school_id, force_password_change, is_active`,
    [adminId, schoolId, passwordHash]
  );

  if (!admin) {
    const error = new Error("School Admin not found for this school");
    error.statusCode = 404;
    throw error;
  }

  return admin;
}

async function updateUser(id, payload) {
  return one(
    `update users
     set name = $2, full_name = $2, email = $3, school_id = $4, grade = $5, stream = $6, is_active = $7, status = case when $7 then 'active' else 'inactive' end, updated_at = now()
     where id = $1
     returning id, school_id, role, full_name, email, username, grade, stream, is_active`,
    [id, payload.full_name, payload.email || null, payload.school_id || null, payload.grade || null, payload.stream || null, payload.is_active]
  );
}

async function deactivateUser(id) {
  return one("update users set is_active = false, updated_at = now() where id = $1 returning id, is_active", [id]);
}

async function softDeleteUser(id) {
  return one("update users set deleted_at = now(), is_active = false, updated_at = now() where id = $1 returning id, deleted_at", [id]);
}

async function listCourses(params = {}) {
  const { limit, offset } = pagination(params);
  const values = [];
  const where = ["deleted_at is null"];
  if (params.club) {
    values.push(params.club);
    where.push(`club = $${values.length}`);
  }
  values.push(limit, offset);
  return list(
    `select id, coalesce(name, title) as name, coalesce(objectives, description) as objectives, club, is_published, published_at, created_at
     from courses where ${where.join(" and ")}
     order by created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
    `select count(*) from courses where ${where.join(" and ")}`,
    values.slice(0, -2)
  );
}

async function createCourse(payload) {
  if (!payload.name) {
    const error = new Error("Course name is required");
    error.statusCode = 400;
    throw error;
  }
  return one(
    `insert into courses (title, name, description, objectives, club, status, is_published)
     values ($1, $1, $2, $2, $3, 'draft', false)
     returning id, coalesce(name, title) as name, coalesce(objectives, description) as objectives, club, is_published, published_at, created_at`,
    [payload.name, payload.objectives || null, payload.club || "Computer Club"]
  );
}

async function updateCourse(id, payload) {
  return one(
    `update courses
     set title = $2, name = $2, description = $3, objectives = $3, club = $4, updated_at = now()
     where id = $1
     returning id, coalesce(name, title) as name, coalesce(objectives, description) as objectives, club, is_published, published_at, created_at`,
    [id, payload.name, payload.objectives || null, payload.club || "Computer Club"]
  );
}

async function publishCourse(id, isPublished) {
  return one(
    `update courses set is_published = $2, status = $4, published_at = $3, updated_at = now()
     where id = $1
     returning id, coalesce(name, title) as name, coalesce(objectives, description) as objectives, club, is_published, published_at, created_at`,
    [id, Boolean(isPublished), isPublished ? new Date().toISOString() : null, isPublished ? "published" : "draft"]
  );
}

async function listGlobalQuestions(params = {}) {
  const { limit, offset } = pagination(params);
  return list(
    `select id, question, option_a, option_b, option_c, option_d, correct_option, is_global, deleted_at, created_at
     from quiz_questions
     where is_global = true and deleted_at is null
     order by created_at desc limit $1 offset $2`,
    [limit, offset],
    "select count(*) from quiz_questions where is_global = true and deleted_at is null",
    []
  );
}

async function listGlobalQuizzes(params = {}) {
  const { limit, offset } = pagination(params);
  return list(
    `select q.id, q.title, q.description, q.grade_levels, q.max_attempts, q.total_points,
            q.time_limit_seconds, q.randomise_order, q.is_published, q.created_at,
            count(qi.question_id)::int as question_count
     from quizzes q
     left join quiz_items qi on qi.quiz_id = q.id
     where q.is_global = true and q.deleted_at is null
     group by q.id
     order by q.created_at desc
     limit $1 offset $2`,
    [limit, offset],
    "select count(*) from quizzes where is_global = true and deleted_at is null",
    []
  );
}

async function getGlobalQuiz(quizId) {
  const quiz = await one(
    `select id, title, description, grade_levels, max_attempts, total_points, time_limit_seconds,
            randomise_order, is_published, created_at
     from quizzes
     where id = $1 and is_global = true and deleted_at is null`,
    [quizId]
  );
  if (!quiz) {
    const error = new Error("Global quiz not found");
    error.statusCode = 404;
    throw error;
  }
  const questions = await query(
    `select qq.id, qq.question, qq.option_a, qq.option_b, qq.option_c, qq.option_d, qq.correct_option, qi.sort_order
     from quiz_items qi
     join quiz_questions qq on qq.id = qi.question_id
     where qi.quiz_id = $1 and qq.deleted_at is null
     order by qi.sort_order`,
    [quizId]
  );
  return { ...quiz, questions: questions.rows };
}

async function createGlobalQuiz(payload, user) {
  const grades = normalizeGrades(payload.grade_levels);
  if (!payload.title) {
    const error = new Error("Quiz title is required");
    error.statusCode = 400;
    throw error;
  }
  return one(
    `insert into quizzes (
       school_id, term_id, title, description, grade_levels, max_attempts, total_points,
       time_limit_seconds, randomise_order, is_global, is_published, created_by
     )
     values (null, null, $1, $2, $3, $4, 100, $5, $6, true, true, $7)
     returning id, title, description, grade_levels, max_attempts, total_points, is_published, created_at`,
    [
      payload.title,
      payload.description || null,
      grades,
      Number(payload.max_attempts || 1),
      payload.time_limit_seconds ? Number(payload.time_limit_seconds) : null,
      Boolean(payload.randomise_order),
      user?.sub || null
    ]
  );
}

async function updateGlobalQuiz(quizId, payload) {
  const grades = normalizeGrades(payload.grade_levels);
  return one(
    `update quizzes
     set title = $2, description = $3, grade_levels = $4, max_attempts = $5,
         time_limit_seconds = $6, randomise_order = $7, is_published = $8, updated_at = now()
     where id = $1 and is_global = true and deleted_at is null
     returning id, title, description, grade_levels, max_attempts, total_points, is_published, updated_at`,
    [
      quizId,
      payload.title,
      payload.description || null,
      grades,
      Number(payload.max_attempts || 1),
      payload.time_limit_seconds ? Number(payload.time_limit_seconds) : null,
      Boolean(payload.randomise_order),
      payload.is_published !== false
    ]
  );
}

async function deleteGlobalQuiz(quizId) {
  return one(
    `update quizzes set deleted_at = now(), is_published = false, updated_at = now()
     where id = $1 and is_global = true and deleted_at is null
     returning id, title, deleted_at`,
    [quizId]
  );
}

async function addQuestionToGlobalQuiz(quizId, payload) {
  const quiz = await one("select id from quizzes where id = $1 and is_global = true and deleted_at is null", [quizId]);
  if (!quiz) {
    const error = new Error("Global quiz not found");
    error.statusCode = 404;
    throw error;
  }
  return transaction(async (client) => {
    const question = await client.query(
      `insert into quiz_questions (question, option_a, option_b, option_c, option_d, correct_option, is_global)
       values ($1, $2, $3, $4, $5, $6, true)
       returning id, question, option_a, option_b, option_c, option_d, correct_option`,
      [
        payload.question,
        payload.option_a,
        payload.option_b,
        payload.option_c,
        payload.option_d,
        normalizeCorrectOption(payload.correct_option)
      ]
    );
    const order = await client.query("select coalesce(max(sort_order), 0) + 1 as next_order from quiz_items where quiz_id = $1", [quizId]);
    await client.query(
      "insert into quiz_items (quiz_id, question_id, sort_order) values ($1, $2, $3)",
      [quizId, question.rows[0].id, order.rows[0].next_order]
    );
    return question.rows[0];
  });
}

async function bulkAddQuestionsToGlobalQuiz(quizId, rows) {
  const created = [];
  const errors = [];
  await transaction(async (client) => {
    const quiz = await client.query("select id from quizzes where id = $1 and is_global = true and deleted_at is null", [quizId]);
    if (!quiz.rows[0]) {
      const error = new Error("Global quiz not found");
      error.statusCode = 404;
      throw error;
    }
    let orderResult = await client.query("select coalesce(max(sort_order), 0) + 1 as next_order from quiz_items where quiz_id = $1", [quizId]);
    let sortOrder = Number(orderResult.rows[0].next_order);
    for (const row of rows) {
      if (!row.question || !row.option_a || !row.option_b || !row.option_c || !row.option_d || !row.correct_option) {
        errors.push({ row: row.__rowNumber, error: "question, option_a, option_b, option_c, option_d, and correct_option are required" });
        continue;
      }
      try {
        const result = await client.query(
          `insert into quiz_questions (question, option_a, option_b, option_c, option_d, correct_option, is_global)
           values ($1, $2, $3, $4, $5, $6, true)
           returning id, question`,
          [row.question, row.option_a, row.option_b, row.option_c, row.option_d, normalizeCorrectOption(row.correct_option)]
        );
        await client.query(
          "insert into quiz_items (quiz_id, question_id, sort_order) values ($1, $2, $3)",
          [quizId, result.rows[0].id, sortOrder]
        );
        sortOrder += 1;
        created.push(result.rows[0]);
      } catch (error) {
        errors.push({ row: row.__rowNumber, error: error.message });
      }
    }
  });
  return { created, errors };
}

async function createGlobalQuestion(payload) {
  return one(
    `insert into quiz_questions (question, option_a, option_b, option_c, option_d, correct_option, is_global)
     values ($1, $2, $3, $4, $5, $6, true) returning *`,
    [payload.question, payload.option_a, payload.option_b, payload.option_c, payload.option_d, payload.correct_option]
  );
}

async function assignQuestionToSchools(questionId, schoolIds) {
  if (!schoolIds.length) return { data: [], count: 0 };
  return transaction(async (client) => {
    const rows = [];
    for (const schoolId of schoolIds) {
      const result = await client.query(
        `insert into quiz_question_school_visibility (question_id, school_id)
         values ($1, $2)
         on conflict (question_id, school_id) do nothing
         returning *`,
        [questionId, schoolId]
      );
      rows.push(...result.rows);
    }
    return { data: rows, count: rows.length };
  });
}

async function dashboardSummary(params = {}) {
  const termId = params.term_id || null;
  const [schools, learners, courses, submissions, auditLogs, quizScores, typingRows] = await Promise.all([
    one("select count(*)::int as count from schools where deleted_at is null"),
    one("select count(*)::int as count from users where role = 'student' and deleted_at is null"),
    one("select count(*)::int as count from courses where deleted_at is null"),
    one("select count(*)::int as count from submissions where status = 'submitted' and ($1::uuid is null or term_id = $1)", [termId]),
    one("select count(*)::int as count from audit_logs"),
    one("select avg(score)::numeric as average from quiz_attempts where ($1::uuid is null or term_id = $1)", [termId]),
    one("select avg(wpm)::numeric as average from typing_results where ($1::uuid is null or term_id = $1)", [termId])
  ]);

  return {
    active_term_id: termId,
    totals: {
      schools: schools.count,
      learners: learners.count,
      courses: courses.count,
      pending_submissions: submissions.count,
      audit_events: auditLogs.count
    },
    performance: {
      average_quiz_score: quizScores.average,
      average_typing_wpm: typingRows.average
    }
  };
}

async function schoolPerformanceGrid(params = {}) {
  const result = await query("select * from system_admin_school_performance($1)", [params.term_id || null]);
  return result.rows;
}

async function auditLogs(params = {}) {
  const { limit, offset } = pagination(params);
  const values = [];
  const where = ["true"];
  if (params.school_id) {
    values.push(params.school_id);
    where.push(`school_id = $${values.length}`);
  }
  if (params.term_id) {
    values.push(params.term_id);
    where.push(`term_id = $${values.length}`);
  }
  if (params.action) {
    values.push(params.action);
    where.push(`action = $${values.length}`);
  }
  values.push(limit, offset);
  return list(
    `select id, actor_user_id, actor_role, action, target_type, target_id, school_id, term_id, metadata, created_at
     from audit_logs where ${where.join(" and ")}
     order by created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
    `select count(*) from audit_logs where ${where.join(" and ")}`,
    values.slice(0, -2)
  );
}

module.exports = {
  assertSystemAdmin,
  listSchools,
  createSchool,
  getSchoolDetail,
  updateSchool,
  suspendSchool,
  softDeleteSchool,
  deleteSchoolPermanently,
  listTerms,
  createAcademicYear,
  createTerm,
  setGlobalActiveTerm,
  listUsers,
  createSchoolAdmin,
  resetSchoolAdminPassword,
  updateUser,
  deactivateUser,
  softDeleteUser,
  listCourses,
  createCourse,
  updateCourse,
  publishCourse,
  listGlobalQuizzes,
  getGlobalQuiz,
  createGlobalQuiz,
  updateGlobalQuiz,
  deleteGlobalQuiz,
  addQuestionToGlobalQuiz,
  bulkAddQuestionsToGlobalQuiz,
  listGlobalQuestions,
  createGlobalQuestion,
  assignQuestionToSchools,
  dashboardSummary,
  schoolPerformanceGrid,
  auditLogs
};
