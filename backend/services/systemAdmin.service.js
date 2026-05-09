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
    `select u.id, u.school_id, u.role, u.full_name, u.email, u.username, u.grade, u.stream, u.is_active,
            u.deleted_at, u.created_at, s.name as school_name
     from users u left join schools s on s.id = u.school_id
     where ${where.join(" and ")}
     order by u.created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
    `select count(*) from users u where ${where.join(" and ")}`,
    values.slice(0, -2)
  );
}

async function updateUser(id, payload) {
  return one(
    `update users
     set full_name = $2, email = $3, school_id = $4, grade = $5, stream = $6, is_active = $7, updated_at = now()
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
    `select id, name, objectives, club, is_published, published_at, created_at
     from courses where ${where.join(" and ")}
     order by created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
    `select count(*) from courses where ${where.join(" and ")}`,
    values.slice(0, -2)
  );
}

async function createCourse(payload) {
  return one(
    "insert into courses (name, objectives, club) values ($1, $2, $3) returning *",
    [payload.name, payload.objectives || null, payload.club || null]
  );
}

async function updateCourse(id, payload) {
  return one(
    "update courses set name = $2, objectives = $3, club = $4, updated_at = now() where id = $1 returning *",
    [id, payload.name, payload.objectives || null, payload.club || null]
  );
}

async function publishCourse(id, isPublished) {
  return one(
    `update courses set is_published = $2, published_at = $3, updated_at = now()
     where id = $1 returning *`,
    [id, Boolean(isPublished), isPublished ? new Date().toISOString() : null]
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
  updateSchool,
  suspendSchool,
  softDeleteSchool,
  listTerms,
  createAcademicYear,
  createTerm,
  setGlobalActiveTerm,
  listUsers,
  updateUser,
  deactivateUser,
  softDeleteUser,
  listCourses,
  createCourse,
  updateCourse,
  publishCourse,
  listGlobalQuestions,
  createGlobalQuestion,
  assignQuestionToSchools,
  dashboardSummary,
  schoolPerformanceGrid,
  auditLogs
};
