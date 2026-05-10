const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { one, list, query, pagination, transaction } = require("../config/database");
const { recordAudit } = require("../utils/audit");

const SYSTEM_ADMIN = "system_admin";
const TERM_LABELS = ["Term 1", "Term 2", "Term 3"];

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

function normalizeTermLabel(value) {
  const label = String(value || "").trim();
  if (!TERM_LABELS.includes(label)) {
    const error = new Error("Term must be Term 1, Term 2, or Term 3");
    error.statusCode = 400;
    throw error;
  }
  return label;
}

function boolFromPayload(value, defaultValue = true) {
  if (value === undefined || value === null) return defaultValue;
  return Boolean(value);
}

async function setGlobalActiveTermWithClient(client, termId, user) {
  await client.query("update terms set is_global_active = false, status = case when status = 'active' then 'draft' else status end");
  const result = await client.query(
    "update terms set is_global_active = true, status = 'active', updated_at = now() where id = $1 returning id, coalesce(label, name::text) as name, starts_on, ends_on, is_global_active",
    [termId]
  );
  const term = result.rows[0];
  if (!term) {
    const error = new Error("Term not found");
    error.statusCode = 404;
    throw error;
  }
  await client.query(
    `insert into school_active_terms (school_id, term_id, activated_by, activated_at)
     select id, $1, $2, now()
     from schools
     where deleted_at is null
     on conflict (school_id) do update set
       term_id = excluded.term_id,
       activated_by = excluded.activated_by,
       activated_at = now()`,
    [termId, user?.sub || null]
  );
  await recordAudit({
    client,
    actor: user,
    action: "term.activate_global",
    targetType: "term",
    targetId: termId,
    termId,
    metadata: { term: term.name }
  });
  return term;
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
    `select s.id, s.name, s.contact_email, s.logo_url, s.clubs, s.status, s.is_active, s.suspended_at, s.deleted_at, s.created_at,
            (select count(*)::int from users u where u.school_id = s.id and u.role = 'student' and u.deleted_at is null) as learner_count,
            (select count(*)::int from users u where u.school_id = s.id and u.role = 'school_admin' and u.deleted_at is null) as admin_count
     from schools s where ${where.join(" and ")}
     order by s.name limit $${values.length - 1} offset $${values.length}`,
    values,
    `select count(*) from schools s where ${where.join(" and ")}`,
    values.slice(0, -2)
  );
}

async function createSchool(payload, user) {
  if (!payload.name) {
    const error = new Error("School name is required");
    error.statusCode = 400;
    throw error;
  }
  const school = await one(
    `insert into schools (name, contact_email, logo_url, clubs, status, is_active)
     values ($1, $2, $3, $4, 'active', true)
     returning *`,
    [payload.name, payload.contact_email || null, payload.logo_url || null, payload.clubs || []]
  );
  await recordAudit({
    actor: user,
    action: "school.create",
    targetType: "school",
    targetId: school.id,
    schoolId: school.id,
    metadata: { name: school.name }
  });
  return school;
}

async function getSchoolDetail(id) {
  const school = await one(
    `select id, name, contact_email, logo_url, clubs, status, is_active, suspended_at, deleted_at, created_at
     from schools
     where id = $1 and deleted_at is null`,
    [id]
  );

  if (!school) {
    const error = new Error("School not found");
    error.statusCode = 404;
    throw error;
  }

  const [admins, learners, counts, progress] = await Promise.all([
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
    ),
    query(
      `select u.id, coalesce(u.full_name, u.name) as full_name, u.username, u.grade, u.stream,
              u.is_active, u.status,
              count(distinct e.id)::int as enrolments,
              avg(qa.score)::numeric as average_quiz_score,
              avg(tr.wpm)::numeric as average_typing_wpm
       from users u
       left join learner_profiles lp on lp.user_id = u.id and lp.school_id = u.school_id
       left join enrolments e on e.learner_id = lp.id and e.school_id = u.school_id
       left join quiz_attempts qa on qa.learner_id = u.id and qa.school_id = u.school_id
       left join typing_results tr on tr.learner_id = u.id and tr.school_id = u.school_id
       where u.school_id = $1 and u.role = 'student' and u.deleted_at is null
       group by u.id
       order by u.grade nulls last, u.stream nulls last, coalesce(u.full_name, u.name)`,
      [id]
    )
  ]);

  return {
    school,
    counts,
    admins: admins.data,
    learners: learners.data,
    progress: progress.rows
  };
}

async function updateSchool(id, payload, user) {
  const school = await one(
    `update schools set name = $2, contact_email = $3, logo_url = $4, clubs = $5, updated_at = now()
     where id = $1 returning *`,
    [id, payload.name, payload.contact_email || null, payload.logo_url || null, payload.clubs || []]
  );
  if (school) {
    await recordAudit({
      actor: user,
      action: "school.update",
      targetType: "school",
      targetId: school.id,
      schoolId: school.id,
      metadata: { name: school.name }
    });
  }
  return school;
}

async function uploadSchoolLogo(id, file, user) {
  if (!file) {
    const error = new Error("School logo file is required");
    error.statusCode = 400;
    throw error;
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  const allowed = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  if (!allowed.has(extension)) {
    const error = new Error("Upload a PNG, JPG, JPEG, or WEBP logo");
    error.statusCode = 400;
    throw error;
  }

  const existing = await one("select id, name from schools where id = $1 and deleted_at is null", [id]);
  if (!existing) {
    const error = new Error("School not found");
    error.statusCode = 404;
    throw error;
  }

  const uploadDir = path.resolve(__dirname, "..", "uploads", "school-logos");
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `${id}-${Date.now()}${extension}`;
  fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
  const logoUrl = `/uploads/school-logos/${filename}`;

  const school = await one(
    `update schools set logo_url = $2, updated_at = now()
     where id = $1
     returning id, name, contact_email, logo_url, clubs, status, is_active, suspended_at, deleted_at, created_at`,
    [id, logoUrl]
  );

  await recordAudit({
    actor: user,
    action: "school.logo_upload",
    targetType: "school",
    targetId: id,
    schoolId: id,
    metadata: { name: existing.name, logo_url: logoUrl }
  });

  return school;
}

async function suspendSchool(id, suspended = true, user) {
  return transaction(async (client) => {
    const activeTerm = await client.query("select id from terms where is_global_active = true limit 1");
    const status = suspended ? "inactive" : "active";
    const result = await client.query(
      `update schools
       set is_active = $2, status = $3, suspended_at = $4, updated_at = now()
       where id = $1 and deleted_at is null
       returning id, name, contact_email, logo_url, clubs, status, is_active, suspended_at, deleted_at, created_at`,
      [id, !suspended, status, suspended ? new Date().toISOString() : null]
    );
    const school = result.rows[0];
    if (!school) {
      const error = new Error("School not found");
      error.statusCode = 404;
      throw error;
    }

    if (suspended) {
      await client.query(
        `update users
         set is_active = false, status = 'school_inactive', updated_at = now()
         where school_id = $1 and deleted_at is null and is_active = true`,
        [id]
      );
    } else {
      await client.query(
        `update users
         set is_active = true, status = 'active', updated_at = now()
         where school_id = $1 and deleted_at is null and status = 'school_inactive'`,
        [id]
      );
    }

    await recordAudit({
      client,
      actor: user,
      action: suspended ? "school.deactivate" : "school.reactivate",
      targetType: "school",
      targetId: school.id,
      schoolId: school.id,
      termId: activeTerm.rows[0]?.id || null,
      metadata: { name: school.name }
    });
    return school;
  });
}

async function softDeleteSchool(id) {
  return suspendSchool(id, true);
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
    `select t.id, t.academic_year_id, coalesce(t.label, t.name::text) as name, t.label, t.starts_on, t.ends_on,
            t.status, t.is_global_active, t.created_at, ay.year
     from terms t join academic_years ay on ay.id = t.academic_year_id
     where ${where.join(" and ")}
     order by t.starts_on desc limit $${values.length - 1} offset $${values.length}`,
    values,
    `select count(*) from terms t where ${where.join(" and ")}`,
    values.slice(0, -2)
  );
}

async function listAcademicYears() {
  const result = await query("select id, year, created_at from academic_years order by year desc");
  return result.rows;
}

async function createAcademicYear(payload, user) {
  const year = Number(payload.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    const error = new Error("Enter a valid academic year");
    error.statusCode = 400;
    throw error;
  }
  const academicYear = await one(
    `insert into academic_years (year)
     values ($1)
     on conflict (year) do update set updated_at = now()
     returning *`,
    [year]
  );
  await recordAudit({
    actor: user,
    action: "academic_year.upsert",
    targetType: "academic_year",
    targetId: academicYear.id,
    metadata: { year }
  });
  return academicYear;
}

async function createTerm(payload, user) {
  const label = normalizeTermLabel(payload.label || payload.name);
  const year = payload.year ? Number(payload.year) : null;

  if (!payload.academic_year_id && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
    const error = new Error("Choose or enter a valid academic year");
    error.statusCode = 400;
    throw error;
  }
  if (!payload.starts_on || !payload.ends_on) {
    const error = new Error("Term start and end dates are required");
    error.statusCode = 400;
    throw error;
  }

  return transaction(async (client) => {
    let academicYearId = payload.academic_year_id || null;
    if (!academicYearId) {
      const academicYear = await client.query(
        `insert into academic_years (year)
         values ($1)
         on conflict (year) do update set updated_at = now()
         returning id`,
        [year]
      );
      academicYearId = academicYear.rows[0].id;
    }

    const result = await client.query(
      `insert into terms (academic_year_id, label, name, starts_on, ends_on, status, is_global_active)
       values ($1, $2, $2::term_name, $3, $4, 'draft', false)
       on conflict (academic_year_id, label) do update set
         name = excluded.name,
         starts_on = excluded.starts_on,
         ends_on = excluded.ends_on,
         updated_at = now()
       returning id, academic_year_id, coalesce(label, name::text) as name, label, starts_on, ends_on, status, is_global_active, created_at`,
      [academicYearId, label, payload.starts_on, payload.ends_on]
    );
    const term = result.rows[0];
    await recordAudit({
      client,
      actor: user,
      action: "term.upsert",
      targetType: "term",
      targetId: term.id,
      termId: term.id,
      metadata: { year, label }
    });

    if (boolFromPayload(payload.make_global_active, true)) {
      return setGlobalActiveTermWithClient(client, term.id, user);
    }

    return term;
  });
}

async function setGlobalActiveTerm(termId, user) {
  return transaction(async (client) => {
    return setGlobalActiveTermWithClient(client, termId, user);
  });
}

async function listUsers(params = {}) {
  const { limit, offset } = pagination(params);
  const values = [];
  const where = ["true"];
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
            u.status, u.deleted_at, u.created_at, u.last_login_at, s.name as school_name, s.is_active as school_active
     from users u left join schools s on s.id = u.school_id
     where ${where.join(" and ")}
     order by u.created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
    `select count(*) from users u where ${where.join(" and ")}`,
    values.slice(0, -2)
  );
}

async function createSchoolAdmin(payload, user) {
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
  const admin = await one(
    `insert into users (school_id, role, name, full_name, email, password_hash, must_change_password, force_password_change, two_factor_enabled, status, is_active)
     values ($1, 'school_admin', $2, $2, lower($3), $4, true, true, false, 'active', true)
     returning id, school_id, role, full_name, email, is_active, created_at`,
    [payload.school_id, payload.full_name, payload.email, passwordHash]
  );
  await recordAudit({
    actor: user,
    action: "user.create_school_admin",
    targetType: "user",
    targetId: admin.id,
    schoolId: admin.school_id,
    metadata: { email: admin.email, full_name: admin.full_name }
  });
  return admin;
}

async function resetSchoolAdminPassword(schoolId, adminId, password, user) {
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

  await recordAudit({
    actor: user,
    action: "user.reset_password",
    targetType: "user",
    targetId: admin.id,
    schoolId: admin.school_id,
    metadata: { role: "school_admin", email: admin.email }
  });

  return admin;
}

async function resetUserPassword(id, password, user) {
  if (!password) {
    const error = new Error("New temporary password is required");
    error.statusCode = 400;
    throw error;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const updated = await one(
    `update users
     set password_hash = $2,
         must_change_password = true,
         force_password_change = true,
         is_active = true,
         status = 'active',
         deleted_at = null,
         updated_at = now()
     where id = $1
     returning id, school_id, role, coalesce(full_name, name) as full_name, email, username, is_active, status, force_password_change`,
    [id, passwordHash]
  );
  if (!updated) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  await recordAudit({
    actor: user,
    action: "user.reset_password",
    targetType: "user",
    targetId: updated.id,
    schoolId: updated.school_id,
    metadata: { role: updated.role, email: updated.email, username: updated.username }
  });
  return updated;
}

async function updateUser(id, payload, user) {
  const updated = await one(
    `update users
     set name = $2, full_name = $2, email = $3, school_id = $4, grade = $5, stream = $6, is_active = $7,
         status = case when $7 then 'active' else 'inactive' end,
         deleted_at = case when $7 then null else deleted_at end,
         updated_at = now()
     where id = $1
     returning id, school_id, role, coalesce(full_name, name) as full_name, email, username, grade, stream, is_active, status, deleted_at`,
    [id, payload.full_name, payload.email || null, payload.school_id || null, payload.grade || null, payload.stream || null, payload.is_active]
  );
  if (!updated) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  await recordAudit({
    actor: user,
    action: "user.update",
    targetType: "user",
    targetId: updated.id,
    schoolId: updated.school_id,
    metadata: { role: updated.role, full_name: updated.full_name }
  });
  return updated;
}

async function deactivateUser(id, user) {
  const updated = await one(
    `update users set is_active = false, status = 'inactive', updated_at = now()
     where id = $1
     returning id, school_id, role, coalesce(full_name, name) as full_name, is_active, status`,
    [id]
  );
  if (updated) {
    await recordAudit({
      actor: user,
      action: "user.deactivate",
      targetType: "user",
      targetId: updated.id,
      schoolId: updated.school_id,
      metadata: { role: updated.role, full_name: updated.full_name }
    });
  }
  return updated;
}

async function softDeleteUser(id, user) {
  return transaction(async (client) => {
    const existing = await client.query(
      `select u.id, u.school_id, u.role, coalesce(u.full_name, u.name) as full_name, lp.id as learner_profile_id
       from users u
       left join learner_profiles lp on lp.user_id = u.id
       where u.id = $1`,
      [id]
    );
    const target = existing.rows[0];
    if (!target) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const updated = await client.query(
      `update users
       set deleted_at = now(), is_active = false, status = 'closed', updated_at = now()
       where id = $1
       returning id, school_id, role, coalesce(full_name, name) as full_name, is_active, status, deleted_at`,
      [id]
    );

    if (target.role === "student" && target.learner_profile_id) {
      await client.query(
        `update enrolments
         set status = 'inactive', updated_at = now()
         where learner_id = $1
           and term_id = (select id from terms where is_global_active = true limit 1)
           and status = 'active'`,
        [target.learner_profile_id]
      );
    }

    await recordAudit({
      client,
      actor: user,
      action: "user.close_account",
      targetType: "user",
      targetId: id,
      schoolId: target.school_id,
      metadata: { role: target.role, full_name: target.full_name }
    });
    return updated.rows[0];
  });
}

async function reactivateUser(id, user) {
  const updated = await one(
    `update users
     set deleted_at = null, is_active = true, status = 'active', updated_at = now()
     where id = $1
     returning id, school_id, role, coalesce(full_name, name) as full_name, email, username, grade, stream, is_active, status, deleted_at`,
    [id]
  );
  if (!updated) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  await recordAudit({
    actor: user,
    action: "user.reactivate",
    targetType: "user",
    targetId: updated.id,
    schoolId: updated.school_id,
    metadata: { role: updated.role, full_name: updated.full_name }
  });
  return updated;
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

async function createCourse(payload, user) {
  if (!payload.name) {
    const error = new Error("Course name is required");
    error.statusCode = 400;
    throw error;
  }
  const course = await one(
    `insert into courses (title, name, description, objectives, club, status, is_published)
     values ($1, $1, $2, $2, $3, 'draft', false)
     returning id, coalesce(name, title) as name, coalesce(objectives, description) as objectives, club, is_published, published_at, created_at`,
    [payload.name, payload.objectives || null, payload.club || "Computer Club"]
  );
  await recordAudit({
    actor: user,
    action: "course.create",
    targetType: "course",
    targetId: course.id,
    metadata: { name: course.name, club: course.club }
  });
  return course;
}

async function updateCourse(id, payload, user) {
  const course = await one(
    `update courses
     set title = $2, name = $2, description = $3, objectives = $3, club = $4, updated_at = now()
     where id = $1
     returning id, coalesce(name, title) as name, coalesce(objectives, description) as objectives, club, is_published, published_at, created_at`,
    [id, payload.name, payload.objectives || null, payload.club || "Computer Club"]
  );
  if (course) {
    await recordAudit({
      actor: user,
      action: "course.update",
      targetType: "course",
      targetId: course.id,
      metadata: { name: course.name, club: course.club }
    });
  }
  return course;
}

async function publishCourse(id, isPublished, user) {
  const course = await one(
    `update courses set is_published = $2, status = $4, published_at = $3, updated_at = now()
     where id = $1
     returning id, coalesce(name, title) as name, coalesce(objectives, description) as objectives, club, is_published, published_at, created_at`,
    [id, Boolean(isPublished), isPublished ? new Date().toISOString() : null, isPublished ? "published" : "draft"]
  );
  if (course) {
    await recordAudit({
      actor: user,
      action: isPublished ? "course.publish" : "course.unpublish",
      targetType: "course",
      targetId: course.id,
      metadata: { name: course.name }
    });
  }
  return course;
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
  const quiz = await one(
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
  await recordAudit({
    actor: user,
    action: "quiz.create_global",
    targetType: "quiz",
    targetId: quiz.id,
    metadata: { title: quiz.title, grade_levels: quiz.grade_levels }
  });
  return quiz;
}

async function updateGlobalQuiz(quizId, payload, user) {
  const grades = normalizeGrades(payload.grade_levels);
  const quiz = await one(
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
  if (quiz) {
    await recordAudit({
      actor: user,
      action: "quiz.update_global",
      targetType: "quiz",
      targetId: quiz.id,
      metadata: { title: quiz.title, grade_levels: quiz.grade_levels }
    });
  }
  return quiz;
}

async function deleteGlobalQuiz(quizId, user) {
  const quiz = await one(
    `update quizzes set deleted_at = now(), is_published = false, updated_at = now()
     where id = $1 and is_global = true and deleted_at is null
     returning id, title, deleted_at`,
    [quizId]
  );
  if (quiz) {
    await recordAudit({
      actor: user,
      action: "quiz.delete_global",
      targetType: "quiz",
      targetId: quiz.id,
      metadata: { title: quiz.title }
    });
  }
  return quiz;
}

async function addQuestionToGlobalQuiz(quizId, payload, user) {
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
    await recordAudit({
      client,
      actor: user,
      action: "quiz.add_question_global",
      targetType: "quiz",
      targetId: quizId,
      metadata: { question_id: question.rows[0].id }
    });
    return question.rows[0];
  });
}

async function bulkAddQuestionsToGlobalQuiz(quizId, rows, user) {
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
    await recordAudit({
      client,
      actor: user,
      action: "quiz.bulk_add_questions_global",
      targetType: "quiz",
      targetId: quizId,
      metadata: { imported: created.length, errors: errors.length }
    });
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

function normalizeTypingTestPayload(payload = {}) {
  const title = String(payload.title || "").trim();
  const passage = String(payload.passage || "").trim();
  if (!title || !passage) {
    const error = new Error("Typing test title and passage are required");
    error.statusCode = 400;
    throw error;
  }
  return {
    title,
    passage,
    durationSeconds: Math.min(Math.max(Number(payload.duration_seconds || 300), 30), 1800),
    gradeLevels: normalizeGrades(payload.grade_levels || [1]),
    isPublished: payload.is_published !== false
  };
}

async function listGlobalTypingTests(params = {}) {
  const { limit, offset } = pagination(params);
  return list(
    `select id, title, duration_seconds, grade_levels, is_global, is_published, created_at,
            left(passage, 140) as passage_preview
     from typing_tests
     where is_global = true and deleted_at is null
     order by created_at desc
     limit $1 offset $2`,
    [limit, offset],
    "select count(*) from typing_tests where is_global = true and deleted_at is null",
    []
  );
}

async function createGlobalTypingTest(payload, user) {
  const normalized = normalizeTypingTestPayload(payload);
  const test = await one(
    `insert into typing_tests (school_id, title, passage, duration_seconds, grade_levels, is_global, is_published, created_by)
     values (null, $1, $2, $3, $4, true, $5, $6)
     returning id, title, passage, duration_seconds, grade_levels, is_global, is_published, created_at`,
    [normalized.title, normalized.passage, normalized.durationSeconds, normalized.gradeLevels, normalized.isPublished, user?.sub || null]
  );
  await recordAudit({
    actor: user,
    action: "typing.create_global",
    targetType: "typing_test",
    targetId: test.id,
    metadata: { title: test.title, grade_levels: test.grade_levels }
  });
  return test;
}

async function updateGlobalTypingTest(id, payload, user) {
  const normalized = normalizeTypingTestPayload(payload);
  const test = await one(
    `update typing_tests
     set title = $2, passage = $3, duration_seconds = $4, grade_levels = $5, is_published = $6, updated_at = now()
     where id = $1 and is_global = true and deleted_at is null
     returning id, title, passage, duration_seconds, grade_levels, is_global, is_published, updated_at`,
    [id, normalized.title, normalized.passage, normalized.durationSeconds, normalized.gradeLevels, normalized.isPublished]
  );
  if (test) {
    await recordAudit({
      actor: user,
      action: "typing.update_global",
      targetType: "typing_test",
      targetId: test.id,
      metadata: { title: test.title }
    });
  }
  return test;
}

async function deleteGlobalTypingTest(id, user) {
  const test = await one(
    `update typing_tests set deleted_at = now(), is_published = false, updated_at = now()
     where id = $1 and is_global = true and deleted_at is null
     returning id, title, deleted_at`,
    [id]
  );
  if (test) {
    await recordAudit({
      actor: user,
      action: "typing.delete_global",
      targetType: "typing_test",
      targetId: test.id,
      metadata: { title: test.title }
    });
  }
  return test;
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
  const { limit, offset } = pagination({ ...params, pageSize: params.pageSize || 30 });
  const values = [];
  const where = ["true"];
  if (params.school_id) {
    values.push(params.school_id);
    where.push(`al.school_id = $${values.length}`);
  }
  if (params.term_id) {
    values.push(params.term_id);
    where.push(`al.term_id = $${values.length}`);
  }
  if (params.action) {
    values.push(like(params.action));
    where.push(`al.action ilike $${values.length}`);
  }
  if (params.actor_role) {
    values.push(params.actor_role);
    where.push(`al.actor_role = $${values.length}`);
  }
  if (params.target_type) {
    values.push(params.target_type);
    where.push(`al.target_type = $${values.length}`);
  }
  const sortMap = {
    created_at: "al.created_at",
    action: "al.action",
    actor_role: "al.actor_role",
    target_type: "al.target_type"
  };
  const sortColumn = sortMap[params.sort] || "al.created_at";
  const direction = String(params.direction || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  values.push(limit, offset);
  return list(
    `select al.id, al.actor_user_id, al.actor_role, al.action, al.target_type, al.target_id, al.school_id, al.term_id,
            al.metadata, al.created_at, coalesce(u.full_name, u.name) as actor_name, s.name as school_name,
            coalesce(t.label, t.name::text) as term_name, ay.year
     from audit_logs al
     left join users u on u.id = al.actor_user_id
     left join schools s on s.id = al.school_id
     left join terms t on t.id = al.term_id
     left join academic_years ay on ay.id = t.academic_year_id
     where ${where.join(" and ")}
     order by ${sortColumn} ${direction}, al.created_at desc
     limit $${values.length - 1} offset $${values.length}`,
    values,
    `select count(*) from audit_logs al where ${where.join(" and ")}`,
    values.slice(0, -2)
  );
}

module.exports = {
  assertSystemAdmin,
  listSchools,
  createSchool,
  getSchoolDetail,
  updateSchool,
  uploadSchoolLogo,
  suspendSchool,
  softDeleteSchool,
  deleteSchoolPermanently,
  listAcademicYears,
  listTerms,
  createAcademicYear,
  createTerm,
  setGlobalActiveTerm,
  listUsers,
  createSchoolAdmin,
  resetSchoolAdminPassword,
  resetUserPassword,
  updateUser,
  deactivateUser,
  softDeleteUser,
  reactivateUser,
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
  listGlobalTypingTests,
  createGlobalTypingTest,
  updateGlobalTypingTest,
  deleteGlobalTypingTest,
  dashboardSummary,
  schoolPerformanceGrid,
  auditLogs
};
