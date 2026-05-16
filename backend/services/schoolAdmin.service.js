const bcrypt = require("bcryptjs");

const { one, list, query, pagination, transaction } = require("../config/database");

const { recordAudit } = require("../utils/audit");

const { ensureDefaultCourses } = require("../utils/courseSeed");

const { ensureTypingColumns, ensureLearnerProfilesSchema } = require("../utils/schemaGuard");
const { buildTermWeeks, availabilityForWeek, moduleOpenDateForWeek } = require("./termWeeks.service");



function assertSchoolAdmin(user) {

  if (!user || user.role !== "school_admin") {

    const error = new Error("School Admin access required");

    error.statusCode = 403;

    throw error;

  }

  if (!user.school_id) {

    const error = new Error("School Admin must be assigned to a school");

    error.statusCode = 403;

    throw error;

  }

}



function scopedSchoolId(user) {

  assertSchoolAdmin(user);

  return user.school_id;

}

async function ensureActivitySubmissionReviewSchema() {
  await query(`
    create table if not exists student_activity_submissions (
      id uuid primary key default gen_random_uuid(),
      activity_block_id uuid not null references lesson_activity_blocks(id) on delete cascade,
      user_id uuid not null references users(id) on delete cascade,
      answer jsonb not null default '{}'::jsonb,
      submission jsonb not null default '{}'::jsonb,
      score numeric(6,2) not null default 0,
      attempts integer not null default 1,
      time_spent_seconds integer not null default 0,
      submitted_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (activity_block_id, user_id)
    )
  `);
  await query("alter table student_activity_submissions add column if not exists feedback text");
  await query("alter table student_activity_submissions add column if not exists review_status text not null default 'submitted'");
  await query("alter table student_activity_submissions add column if not exists reviewed_by uuid references users(id) on delete set null");
  await query("alter table student_activity_submissions add column if not exists reviewed_at timestamptz");
}



async function enrolmentLearnerReferenceTable(client) {

  const result = await client.query(`

    select referenced.relname as referenced_table

    from pg_constraint constraint_info

    join pg_class source on source.oid = constraint_info.conrelid

    join pg_class referenced on referenced.oid = constraint_info.confrelid

    join pg_attribute source_column on source_column.attrelid = source.oid and source_column.attnum = any(constraint_info.conkey)

    where source.relname = 'enrolments'

      and source_column.attname = 'learner_id'

      and constraint_info.contype = 'f'

    limit 1

  `);

  return result.rows[0]?.referenced_table || "users";

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



function gradeBand(score) {

  const value = Number(score);

  if (value <= 50) return "Approaching expectation";

  if (value <= 80) return "Meets expectation";

  return "Exceeding expectation";

}



async function profile(user) {

  const schoolId = scopedSchoolId(user);

  return one(

    `select u.id, coalesce(u.full_name, u.name) as full_name, u.email, u.role, u.school_id, u.previous_login_at, u.last_login_at,

            s.name as school_name, s.logo_url, s.clubs

     from users u

     join schools s on s.id = u.school_id

     where u.id = $1 and u.school_id = $2`,

    [user.sub, schoolId]

  );

}



async function activeTerm(user) {

  scopedSchoolId(user);

  return one(

    `select t.id, coalesce(t.label, t.name::text) as name, t.starts_on, t.ends_on, ay.year

     from terms t

     join academic_years ay on ay.id = t.academic_year_id

     where t.is_global_active = true

     order by t.starts_on desc

     limit 1`

  );

}



async function terms(user) {

  scopedSchoolId(user);

  const result = await query(

    `select t.id, coalesce(t.label, t.name::text) as name, t.starts_on, t.ends_on, ay.year,

            t.is_global_active as is_active

     from terms t

     join academic_years ay on ay.id = t.academic_year_id

     order by t.starts_on desc`

  );

  return result.rows;

}

async function termWeeks(user, termId = null) {
  scopedSchoolId(user);
  const term = termId
    ? await one(
      `select t.id, coalesce(t.label, t.name::text) as name, t.starts_on, t.ends_on, ay.year
       from terms t
       join academic_years ay on ay.id = t.academic_year_id
       where t.id = $1`,
      [termId]
    )
    : await activeTerm(user);

  if (!term && !termId) {
    return { term: null, weeks: [] };
  }

  if (!term) {
    const error = new Error("Term not found");
    error.statusCode = 404;
    throw error;
  }

  return { term, weeks: buildTermWeeks(term) };
}



async function dashboardSummary(user, params = {}) {

  const schoolId = scopedSchoolId(user);

  const term = params.term_id ? { id: params.term_id } : await activeTerm(user);

  const termId = term?.id || null;



  const [learners, courses, pending, avgProgress, typing, quizzes, reports] = await Promise.all([

    one("select count(*)::int as count from users where role = 'student' and school_id = $1 and deleted_at is null", [schoolId]),

    one(

      `select count(distinct course_id)::int as count

       from enrolments where school_id = $1 and ($2::uuid is null or term_id = $2)`,

      [schoolId, termId]

    ),

    one(

      `select count(*)::int as count

       from submissions where school_id = $1 and status = 'submitted' and ($2::uuid is null or term_id = $2)`,

      [schoolId, termId]

    ),

    one(

      `select avg(lp.score)::numeric as average

       from lesson_progress lp

       join users u on u.id = lp.learner_id

       where u.school_id = $1`,

      [schoolId]

    ),

    one(

      `select avg(wpm)::numeric as average_wpm, avg(accuracy)::numeric as average_accuracy, count(*)::int as count

       from (

         select school_id, term_id, wpm, accuracy from typing_results

         union all

         select school_id, term_id, wpm, accuracy from typing_attempts

       ) typing

       where school_id = $1 and ($2::uuid is null or term_id = $2)`,

      [schoolId, termId]

    ),

    one(

      `select avg(score)::numeric as average_score, count(*)::int as count

       from quiz_attempts where school_id = $1 and ($2::uuid is null or term_id = $2)`,

      [schoolId, termId]

    ),

    one(

      `select count(*)::int as count

       from report_cards where school_id = $1 and ($2::uuid is null or term_id = $2)`,

      [schoolId, termId]

    )

  ]);



  return {

    active_term: term,

    totals: {

      learners: learners.count,

      active_courses: courses.count,

      pending_submissions: pending.count,

      report_cards: reports.count

    },

    performance: {

      average_progress_score: avgProgress.average,

      average_typing_wpm: typing.average_wpm,

      average_typing_accuracy: typing.average_accuracy,

      typing_results_count: typing.count,

      average_quiz_score: quizzes.average_score,

      quiz_attempts_count: quizzes.count

    }

  };

}



async function enrolmentByCourse(user, params = {}) {

  const schoolId = scopedSchoolId(user);

  const termId = params.term_id || null;

  const result = await query(

    `select c.id, coalesce(c.name, c.title) as name, count(e.id)::int as enrolment_count

     from courses c

     join enrolments e on e.course_id = c.id

     where e.school_id = $1 and e.status = 'active' and ($2::uuid is null or e.term_id = $2)

     group by c.id, coalesce(c.name, c.title)

     order by coalesce(c.name, c.title)`,

    [schoolId, termId]

  );

  return result.rows;

}

async function courseCertificateLearners(user, courseId, params = {}) {
  const schoolId = scopedSchoolId(user);
  const termId = params.term_id || null;
  const course = await one(
    `select id, coalesce(name, title) as name from courses where id = $1 and deleted_at is null`,
    [courseId]
  );
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }

  const total = await one(
    `select count(*)::int as total
     from lesson_activity_blocks b
     join lessons l on l.id = b.lesson_id
     join modules m on m.id = l.module_id
     where m.course_id = $1`,
    [courseId]
  );

  const result = await query(
    `select u.id, coalesce(u.full_name, u.name, concat_ws(' ', u.first_name, u.last_name)) as learner_name,
            u.email, u.grade, u.stream,
            count(distinct sa.activity_block_id)::int as completed_activities
     from enrolments e
     left join learner_profiles lp on lp.id = e.learner_id
     join users u on u.id = e.learner_id or u.id = lp.user_id
     left join student_activity_submissions sa on sa.user_id = u.id
     left join lesson_activity_blocks b on b.id = sa.activity_block_id
     left join lessons l on l.id = b.lesson_id
     left join modules m on m.id = l.module_id and m.course_id = e.course_id
     where e.school_id = $1
       and e.course_id = $2
       and e.status = 'active'
       and ($3::uuid is null or e.term_id = $3)
       and u.role = 'student'
       and u.deleted_at is null
       and (m.course_id = $2 or sa.id is null)
     group by u.id, learner_name, u.email, u.grade, u.stream
     order by learner_name`,
    [schoolId, courseId, termId]
  );

  const totalActivities = Number(total?.total || 0);
  return {
    course,
    total_activities: totalActivities,
    learners: result.rows.map((row) => {
      const completion_percent = totalActivities ? Math.round((Number(row.completed_activities || 0) / totalActivities) * 100) : 0;
      return {
        ...row,
        completion_percent,
        certificate_ready: completion_percent >= 80
      };
    })
  };
}



async function classProgress(user, params = {}) {

  const schoolId = scopedSchoolId(user);

  const result = await query(

    `select u.grade, u.stream, count(distinct u.id)::int as learner_count, avg(lp.score)::numeric as average_score

     from users u

     left join lesson_progress lp on lp.learner_id = u.id

     where u.school_id = $1 and u.role = 'student' and u.deleted_at is null

     group by u.grade, u.stream

     order by u.grade nulls last, u.stream nulls last`,

    [schoolId]

  );

  return result.rows;

}



async function listLearners(user, params = {}) {

  const schoolId = scopedSchoolId(user);

  const { limit, offset } = pagination(params);

  const values = [schoolId];

  const where = ["school_id = $1", "role = 'student'", "deleted_at is null"];

  if (params.grade) {

    values.push(Number(params.grade));

    where.push(`grade = $${values.length}`);

  }

  if (params.stream) {

    values.push(params.stream);

    where.push(`stream = $${values.length}`);

  }

  if (params.search) {

    values.push(like(params.search));

    where.push(`(full_name ilike $${values.length} or username ilike $${values.length})`);

  }

  values.push(limit, offset);



  return list(

    `select id, coalesce(full_name, name) as full_name, username, grade, stream, parent_name, parent_email, parent_phone, is_active, created_at, last_login_at

     from users

     where ${where.join(" and ")}

     order by full_name limit $${values.length - 1} offset $${values.length}`,

    values,

    `select count(*) from users where ${where.join(" and ")}`,

    values.slice(0, -2)

  );

}



async function generateUsername(fullName, schoolId, client = { query }) {

  const base = fullName.toLowerCase().replace(/[^a-z0-9]/g, "");

  let candidate = base || "learner";

  let suffix = 1;



  while (true) {

    const result = await client.query(

      "select id from users where lower(username) = $1 and deleted_at is null limit 1",

      [candidate]

    );

    if (result.rows.length === 0) return candidate;

    suffix += 1;

    candidate = `${base}${suffix}`;

  }

}



async function upsertLearnerProfile(client, schoolId, learner) {
  await ensureLearnerProfilesSchema(client);

  const result = await client.query(

    `insert into learner_profiles (user_id, school_id, full_name, grade, stream, parent_name, parent_email, parent_phone)

     values ($1, $2, $3, $4, $5, $6, $7, $8)

     on conflict (user_id) do update set

       full_name = excluded.full_name,

       grade = excluded.grade,

       stream = excluded.stream,

       parent_name = excluded.parent_name,

       parent_email = excluded.parent_email,

       parent_phone = excluded.parent_phone

     returning id`,

    [

      learner.id,

      schoolId,

      learner.full_name,

      String(learner.grade),

      learner.stream || null,

      learner.parent_name || null,

      learner.parent_email || null,

      learner.parent_phone || null

    ]

  );

  return result.rows[0];

}



async function addLearner(user, payload) {

  const schoolId = scopedSchoolId(user);

  const password = payload.temporary_password || "Password";

  if (!payload.full_name || !payload.grade) {

    const error = new Error("Learner full name and grade are required");

    error.statusCode = 400;

    throw error;

  }



  return transaction(async (client) => {

    const username = await generateUsername(payload.full_name, schoolId, client);

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await client.query(

      `insert into users (

        school_id, role, name, full_name, username, password_hash, grade, stream, date_of_birth,

        parent_name, parent_email, parent_phone, must_change_password, force_password_change, status, is_active

      )

       values ($1, 'student', $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, true, 'active', true)

       returning id, full_name, username, grade, stream, parent_name, parent_email, parent_phone, is_active`,

      [

        schoolId,

        payload.full_name,

        username,

        passwordHash,

        Number(payload.grade),

        payload.stream || null,

        payload.date_of_birth || null,

        payload.parent_name || null,

        payload.parent_email || null,

        payload.parent_phone || null

      ]

    );

    await upsertLearnerProfile(client, schoolId, result.rows[0]);

    await recordAudit({

      client,

      actor: user,

      action: "learner.create",

      targetType: "user",

      targetId: result.rows[0].id,

      schoolId,

      metadata: { full_name: result.rows[0].full_name, username: result.rows[0].username }

    });

    return result.rows[0];

  });

}



async function bulkImportLearners(user, rows) {

  const schoolId = scopedSchoolId(user);

  if (!rows.length) {

    const error = new Error("The uploaded file has no learner rows");

    error.statusCode = 400;

    throw error;

  }



  const cleanRows = rows

    .map((row, index) => ({

      row_number: row.__rowNumber || index + 2,

      full_name: row["child name"] || row["Child Name"] || row["full name"] || row["Full Name"] || row.name || row.Name,

      grade: row.grade || row.Grade,

      stream: row.stream || row.Stream || null

    }))

    .filter((row) => row.full_name || row.grade || row.stream);



  const errors = [];

  const created = [];



  await transaction(async (client) => {

    for (let index = 0; index < cleanRows.length; index += 1) {

      const row = cleanRows[index];

      if (!row.full_name || !row.grade) {

        errors.push({ row: row.row_number, error: "Child name and grade are required" });

        continue;

      }

      if (!Number.isFinite(Number(row.grade))) {

        errors.push({ row: row.row_number, error: "Grade must be a number" });

        continue;

      }



      const username = await generateUsername(row.full_name, schoolId, client);

      const passwordHash = await bcrypt.hash("Password", 12);

      const result = await client.query(

        `insert into users (

        school_id, role, name, full_name, username, password_hash, grade, stream,

          must_change_password, force_password_change, status, is_active

        )

         values ($1, 'student', $2, $2, $3, $4, $5, $6, true, true, 'active', true)

         returning id, full_name, username, grade, stream, parent_name, parent_email, parent_phone`,

        [schoolId, row.full_name, username, passwordHash, Number(row.grade), row.stream || null]

      );

      await upsertLearnerProfile(client, schoolId, result.rows[0]);

      await recordAudit({

        client,

        actor: user,

        action: "learner.bulk_create",

        targetType: "user",

        targetId: result.rows[0].id,

        schoolId,

        metadata: { full_name: result.rows[0].full_name, username: result.rows[0].username, row: row.row_number }

      });

      created.push(result.rows[0]);

    }

  });



  return { created, errors, default_password: "Password" };

}



async function updateLearner(user, learnerId, payload) {

  const schoolId = scopedSchoolId(user);

  return transaction(async (client) => {

    const isActive = payload.is_active === undefined ? null : Boolean(payload.is_active);

    const result = await client.query(

      `update users

       set name = $3, full_name = $3, grade = $4, stream = $5, parent_name = $6, parent_email = $7, parent_phone = $8,

           is_active = coalesce($9::boolean, is_active),

           status = case when $9::boolean is null then status when $9::boolean then 'active' else 'inactive' end,

           updated_at = now()

       where id = $1 and school_id = $2 and role = 'student'

       returning id, full_name, username, grade, stream, parent_name, parent_email, parent_phone, is_active, status`,

      [

        learnerId,

        schoolId,

        payload.full_name,

        Number(payload.grade),

        payload.stream || null,

        payload.parent_name || null,

        payload.parent_email || null,

        payload.parent_phone || null,

        isActive

      ]

    );

    if (!result.rows[0]) return null;

    await upsertLearnerProfile(client, schoolId, result.rows[0]);

    await recordAudit({

      client,

      actor: user,

      action: "learner.update",

      targetType: "user",

      targetId: learnerId,

      schoolId,

      metadata: { full_name: result.rows[0].full_name, is_active: result.rows[0].is_active }

    });

    return result.rows[0];

  });

}



async function setLearnerActive(user, learnerId, active) {

  const schoolId = scopedSchoolId(user);

  const learner = await one(

    `update users

     set is_active = $3, status = case when $3 then 'active' else 'inactive' end, updated_at = now()

     where id = $1 and school_id = $2 and role = 'student' and deleted_at is null

     returning id, coalesce(full_name, name) as full_name, username, grade, stream, parent_name, parent_email, parent_phone, is_active, status`,

    [learnerId, schoolId, Boolean(active)]

  );

  if (!learner) {

    const error = new Error("Learner not found");

    error.statusCode = 404;

    throw error;

  }

  await recordAudit({

    actor: user,

    action: active ? "learner.reactivate" : "learner.deactivate",

    targetType: "user",

    targetId: learner.id,

    schoolId,

    metadata: { full_name: learner.full_name, username: learner.username }

  });

  return learner;

}



async function promoteLearner(user, learnerId, payload = {}) {

  const schoolId = scopedSchoolId(user);

  const mode = payload.mode || "next_grade";



  if (!["next_term", "next_grade"].includes(mode)) {

    const error = new Error("Promotion mode must be next_term or next_grade");

    error.statusCode = 400;

    throw error;

  }



  return transaction(async (client) => {

    const existing = await client.query(

      `select id, coalesce(full_name, name) as full_name, grade, stream, parent_name, parent_email, parent_phone

       from users

       where id = $1 and school_id = $2 and role = 'student' and deleted_at is null`,

      [learnerId, schoolId]

    );



    if (!existing.rows[0]) {

      const error = new Error("Learner not found");

      error.statusCode = 404;

      throw error;

    }



    const learner = existing.rows[0];

    const newGrade = mode === "next_grade" ? Number(learner.grade || 0) + 1 : Number(learner.grade || 0);

    const newStream = payload.stream !== undefined ? payload.stream || null : learner.stream || null;

    const note = mode === "next_grade" ? "Promoted to next grade" : "Promoted to next term";



    const updated = await client.query(

      `update users

       set grade = $3, stream = $4, updated_at = now()

       where id = $1 and school_id = $2 and role = 'student'

       returning id, coalesce(full_name, name) as full_name, username, grade, stream, parent_name, parent_email, parent_phone`,

      [learnerId, schoolId, newGrade, newStream]

    );



    await client.query(

      `insert into grade_history (learner_id, school_id, old_grade, new_grade, old_stream, new_stream, approved_by, note)

       values ($1, $2, $3, $4, $5, $6, $7, $8)`,

      [learnerId, schoolId, learner.grade, newGrade, learner.stream, newStream, user.sub, payload.note || note]

    );



    await upsertLearnerProfile(client, schoolId, updated.rows[0]);

    await recordAudit({

      client,

      actor: user,

      action: mode === "next_grade" ? "learner.promote_grade" : "learner.promote_term",

      targetType: "user",

      targetId: learnerId,

      schoolId,

      metadata: { old_grade: learner.grade, new_grade: newGrade, old_stream: learner.stream, new_stream: newStream }

    });

    return updated.rows[0];

  });

}



async function listSubmissions(user, params = {}) {

  await ensureActivitySubmissionReviewSchema();

  const schoolId = scopedSchoolId(user);

  const { limit, offset } = pagination(params);

  const termId = params.term_id || null;

  return list(

    `select * from (
       select s.id::text as id, 'file' as source, s.learner_id, s.term_id, s.lesson_id, null::uuid as activity_block_id,
              s.file_url, s.status, s.feedback, s.reviewed_at, s.created_at,
              u.full_name as learner_name, u.grade, u.stream, c.name as course_name, l.title as lesson_name,
              'File upload' as activity_type, '{}'::jsonb as answer, '{}'::jsonb as submission, null::numeric as score
       from submissions s
       join users u on u.id = s.learner_id
       left join lessons l on l.id = s.lesson_id
       left join modules m on m.id = l.module_id
       left join courses c on c.id = m.course_id
       where s.school_id = $1 and ($2::uuid is null or s.term_id = $2)

       union all

       select ('activity:' || sa.id)::text as id, 'activity' as source, u.id as learner_id, null::uuid as term_id, l.id as lesson_id,
              b.id as activity_block_id, null::text as file_url, coalesce(sa.review_status, 'submitted') as status, sa.feedback,
              sa.reviewed_at, sa.submitted_at as created_at, u.full_name as learner_name, u.grade, u.stream,
              c.name as course_name, l.title as lesson_name, b.activity_type, sa.answer, sa.submission, sa.score
       from student_activity_submissions sa
       join users u on u.id = sa.user_id
       join lesson_activity_blocks b on b.id = sa.activity_block_id
       join lessons l on l.id = b.lesson_id
       join modules m on m.id = l.module_id
       join courses c on c.id = m.course_id
       where u.school_id = $1
         and b.activity_type in ('assignment_submission', 'submission', 'practice_code', 'auto_marked_code', 'practice', 'creative_corner', 'teacher_task', 'runnable_code', 'quiz')
     ) rows
     order by case when status = 'submitted' then 0 else 1 end, created_at desc
     limit $3 offset $4`,

    [schoolId, termId, limit, offset],

    `select count(*) from (
       select s.id from submissions s where s.school_id = $1 and ($2::uuid is null or s.term_id = $2)
       union all
       select sa.id
       from student_activity_submissions sa
       join users u on u.id = sa.user_id
       join lesson_activity_blocks b on b.id = sa.activity_block_id
       where u.school_id = $1
         and b.activity_type in ('assignment_submission', 'submission', 'practice_code', 'auto_marked_code', 'practice', 'creative_corner', 'teacher_task', 'runnable_code', 'quiz')
     ) counts`,

    [schoolId, termId]

  );

}



async function reviewSubmission(user, submissionId, payload) {

  await ensureActivitySubmissionReviewSchema();

  const schoolId = scopedSchoolId(user);

  if (String(submissionId).startsWith("activity:")) {
    const activitySubmissionId = String(submissionId).replace("activity:", "");
    return one(
      `update student_activity_submissions sa
       set feedback = $3, review_status = 'reviewed', reviewed_by = $4, reviewed_at = now(), updated_at = now()
       from users u
       where sa.id = $1 and sa.user_id = u.id and u.school_id = $2
       returning ('activity:' || sa.id)::text as id, 'activity' as source, sa.activity_block_id, sa.user_id as learner_id,
                 sa.feedback, sa.review_status as status, sa.reviewed_at, sa.submitted_at as created_at, sa.score, sa.answer, sa.submission`,
      [activitySubmissionId, schoolId, payload.feedback, user.sub]
    );
  }

  return one(

    `update submissions

     set feedback = $3, status = 'reviewed', reviewed_by = $4, reviewed_at = now()

     where id = $1 and school_id = $2

     returning *`,

    [submissionId, schoolId, payload.feedback, user.sub]

  );

}



async function typingResults(user, params = {}) {

  const schoolId = scopedSchoolId(user);

  const { limit, offset } = pagination(params);

  const termId = params.term_id || null;

  return list(

    `select tr.id, tr.learner_id, tr.term_id, tr.wpm, tr.accuracy, tr.time_taken_seconds, tr.created_at,

            tt.title as test_title, u.full_name as learner_name, u.grade, u.stream

     from (

       select id, learner_id, school_id, term_id, wpm, accuracy, time_taken_seconds, created_at, null::uuid as typing_test_id

       from typing_results

       union all

       select id, learner_id, school_id, term_id, wpm, accuracy, time_taken_seconds, created_at, typing_test_id

       from typing_attempts

     ) tr

     left join typing_tests tt on tt.id = tr.typing_test_id

     join users u on u.id = tr.learner_id

     where tr.school_id = $1 and ($2::uuid is null or tr.term_id = $2)

     order by tr.created_at desc limit $3 offset $4`,

    [schoolId, termId, limit, offset],

    `select (

       (select count(*) from typing_results where school_id = $1 and ($2::uuid is null or term_id = $2)) +

       (select count(*) from typing_attempts where school_id = $1 and ($2::uuid is null or term_id = $2))

     ) as count`,

    [schoolId, termId]

  );

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

    maxAttempts: Math.min(Math.max(Number(payload.max_attempts || 3), 1), 20),

    gradeLevels: normalizeGrades(payload.grade_levels || [1]),

    isPublished: payload.is_published !== false

  };

}



async function globalTypingTests(user) {

  scopedSchoolId(user);

  await ensureTypingColumns({ query });

  const result = await query(

    `select id, title, duration_seconds, max_attempts, grade_levels, is_global, is_published, created_at,

            left(passage, 140) as passage_preview

     from typing_tests

     where is_global = true and is_published = true and deleted_at is null

     order by created_at desc`

  );

  return result.rows;

}



async function schoolTypingTests(user) {

  const schoolId = scopedSchoolId(user);

  await ensureTypingColumns({ query });

  const result = await query(

    `select id, title, duration_seconds, max_attempts, grade_levels, is_global, is_published, created_at,

            passage, left(passage, 140) as passage_preview

     from typing_tests

     where school_id = $1 and is_global = false and deleted_at is null

     order by created_at desc`,

    [schoolId]

  );

  return result.rows;

}



async function createSchoolTypingTest(user, payload) {

  const schoolId = scopedSchoolId(user);

  const normalized = normalizeTypingTestPayload(payload);

  const test = await one(

    `insert into typing_tests (school_id, title, passage, duration_seconds, max_attempts, grade_levels, is_global, is_published, created_by)

     values ($1, $2, $3, $4, $5, $6, false, $7, $8)

     returning id, title, passage, duration_seconds, max_attempts, grade_levels, is_global, is_published, created_at`,

    [schoolId, normalized.title, normalized.passage, normalized.durationSeconds, normalized.maxAttempts, normalized.gradeLevels, normalized.isPublished, user.sub]

  );

  await recordAudit({

    actor: user,

    action: "typing.create_school",

    targetType: "typing_test",

    targetId: test.id,

    schoolId,

    metadata: { title: test.title, grade_levels: test.grade_levels }

  });

  return test;

}



async function updateSchoolTypingTest(user, testId, payload) {

  const schoolId = scopedSchoolId(user);

  const normalized = normalizeTypingTestPayload(payload);

  const test = await one(

    `update typing_tests

     set title = $3, passage = $4, duration_seconds = $5, max_attempts = $6, grade_levels = $7,

         is_published = $8, updated_at = now()

     where id = $1 and school_id = $2 and is_global = false and deleted_at is null

     returning id, title, passage, duration_seconds, max_attempts, grade_levels, is_global, is_published, created_at, updated_at`,

    [testId, schoolId, normalized.title, normalized.passage, normalized.durationSeconds, normalized.maxAttempts, normalized.gradeLevels, normalized.isPublished]

  );

  if (!test) {

    const error = new Error("Typing test not found or not available to this school");

    error.statusCode = 404;

    throw error;

  }

  await recordAudit({

    actor: user,

    action: "typing.update_school",

    targetType: "typing_test",

    targetId: test.id,

    schoolId,

    metadata: { title: test.title, grade_levels: test.grade_levels }

  });

  return test;

}



async function assignTypingTest(user, testId, payload = {}) {

  const schoolId = scopedSchoolId(user);

  const grades = normalizeGrades(payload.grades || payload.grade_levels);

  const term = payload.term_id
    ? await one("select id, starts_on, ends_on from terms where id = $1", [payload.term_id])
    : await activeTerm(user);

  const termId = term?.id || null;

  if (!termId) {

    const error = new Error("An active term is required before assigning typing tests");

    error.statusCode = 400;

    throw error;

  }

  const test = await one(

    `select id, title, grade_levels, is_global, school_id

     from typing_tests

     where id = $1 and deleted_at is null and is_published = true and (is_global = true or school_id = $2)`,

    [testId, schoolId]

  );

  if (!test) {

    const error = new Error("Typing test not found or not available to this school");

    error.statusCode = 404;

    throw error;

  }

  const allowed = (test.grade_levels || []).map((grade) => Number(grade));

  const blocked = grades.filter((grade) => !allowed.includes(grade));

  if (blocked.length) {

    const error = new Error(`This typing test is only available to Grade ${allowed.join("-") || "none"}`);

    error.statusCode = 400;

    throw error;

  }

  const availability = payload.week_number
    ? availabilityForWeek(term, payload.week_number)
    : { available_from: payload.available_from || null, available_until: payload.available_until || null };

  if (payload.week_number && !availability) {
    const error = new Error("Selected week is not inside the active term");
    error.statusCode = 400;
    throw error;
  }

  return transaction(async (client) => {

    const assigned = [];

    for (const grade of grades) {

      const result = await client.query(

        `insert into typing_assignments (typing_test_id, school_id, term_id, grade, assigned_by, week_number, available_from, available_until, is_active)

         values ($1, $2, $3, $4, $5, $6, $7, $8, true)

         on conflict (typing_test_id, school_id, term_id, grade) do update set

           available_from = excluded.available_from,

           available_until = excluded.available_until,

           week_number = excluded.week_number,

           is_active = true,

           assigned_by = excluded.assigned_by,

           assigned_at = now()

         returning *`,

        [testId, schoolId, termId, grade, user.sub, payload.week_number || null, availability.available_from, availability.available_until]

      );

      assigned.push(result.rows[0]);

    }

    await recordAudit({

      client,

      actor: user,

      action: "typing.assign",

      targetType: "typing_test",

      targetId: testId,

      schoolId,

      termId,

      metadata: { grades, count: assigned.length, week_number: payload.week_number || null }

    });

    return { assigned, count: assigned.length };

  });

}



async function typingAssignments(user, params = {}) {

  const schoolId = scopedSchoolId(user);

  const termId = params.term_id || null;

  const result = await query(

    `select ta.id, ta.typing_test_id, ta.term_id, ta.grade, ta.is_active, ta.available_from, ta.available_until, ta.assigned_at,

            tt.title, tt.duration_seconds, tt.max_attempts, tt.grade_levels, tt.is_global,

            count(distinct u.id)::int as learner_count,

            count(distinct at.id)::int as attempts

     from typing_assignments ta

     join typing_tests tt on tt.id = ta.typing_test_id

     left join users u on u.school_id = ta.school_id and u.role = 'student' and u.grade = ta.grade and u.deleted_at is null

     left join typing_attempts at on at.assignment_id = ta.id

     where ta.school_id = $1 and ($2::uuid is null or ta.term_id = $2)

     group by ta.id, tt.id

     order by ta.assigned_at desc`,

    [schoolId, termId]

  );

  return result.rows;

}



async function typingPerformance(user, params = {}) {

  const schoolId = scopedSchoolId(user);

  const termId = params.term_id || null;

  const result = await query(

    `select ta.typing_test_id, tt.title as test_title, count(at.id)::int as attempts,

            avg(at.wpm)::numeric as average_wpm,

            max(at.wpm)::numeric as best_wpm,

            avg(at.accuracy)::numeric as average_accuracy

     from typing_attempts at

     left join typing_assignments ta on ta.id = at.assignment_id

     left join typing_tests tt on tt.id = at.typing_test_id

     where at.school_id = $1 and ($2::uuid is null or at.term_id = $2)

     group by ta.typing_test_id, tt.title

     order by tt.title nulls last`,

    [schoolId, termId]

  );

  return result.rows;

}



async function quizResults(user, params = {}) {

  const schoolId = scopedSchoolId(user);

  const { limit, offset } = pagination(params);

  const termId = params.term_id || null;

  return list(

    `select qa.id, qa.quiz_id, qa.learner_id, qa.term_id, qa.score, qa.time_taken_seconds, qa.created_at,

            q.title as quiz_title, u.full_name as learner_name, u.grade, u.stream

     from quiz_attempts qa

     left join quizzes q on q.id = qa.quiz_id

     join users u on u.id = qa.learner_id

     where qa.school_id = $1 and ($2::uuid is null or qa.term_id = $2)

     order by qa.created_at desc limit $3 offset $4`,

    [schoolId, termId, limit, offset],

    "select count(*) from quiz_attempts where school_id = $1 and ($2::uuid is null or term_id = $2)",

    [schoolId, termId]

  );

}



async function globalQuizzes(user) {

  scopedSchoolId(user);

  const result = await query(

    `select q.id, q.title, q.description, q.grade_levels, q.max_attempts, q.total_points,

            q.time_limit_seconds, q.randomise_order, q.created_at,

            count(qi.question_id)::int as question_count

     from quizzes q

     left join quiz_items qi on qi.quiz_id = q.id

     where q.is_global = true and q.is_published = true and q.deleted_at is null

     group by q.id

     order by q.created_at desc`

  );

  return result.rows;

}



async function schoolQuizzes(user) {

  const schoolId = scopedSchoolId(user);

  const result = await query(

    `select q.id, q.title, q.description, q.grade_levels, q.max_attempts, q.total_points,

            q.time_limit_seconds, q.randomise_order, q.is_published, q.created_at,

            count(qi.question_id)::int as question_count

     from quizzes q

     left join quiz_items qi on qi.quiz_id = q.id

     where q.school_id = $1 and q.is_global = false and q.deleted_at is null

     group by q.id

     order by q.created_at desc`,

    [schoolId]

  );

  return result.rows;

}



async function createSchoolQuiz(user, payload) {

  const schoolId = scopedSchoolId(user);

  const grades = normalizeGrades(payload.grade_levels);

  if (!payload.title) {

    const error = new Error("Quiz title is required");

    error.statusCode = 400;

    throw error;

  }

  const quiz = await one(

    `insert into quizzes (

       school_id, title, description, grade_levels, max_attempts, total_points,

       time_limit_seconds, randomise_order, is_global, is_published, created_by

     )

     values ($1, $2, $3, $4, $5, 100, $6, $7, false, true, $8)

     returning id, title, description, grade_levels, max_attempts, total_points, is_published, created_at`,

    [

      schoolId,

      payload.title,

      payload.description || null,

      grades,

      Number(payload.max_attempts || 1),

      payload.time_limit_seconds ? Number(payload.time_limit_seconds) : null,

      Boolean(payload.randomise_order),

      user.sub

    ]

  );

  await recordAudit({

    actor: user,

    action: "quiz.create_school",

    targetType: "quiz",

    targetId: quiz.id,

    schoolId,

    metadata: { title: quiz.title, grade_levels: quiz.grade_levels }

  });

  return quiz;

}



async function addQuestionToSchoolQuiz(user, quizId, payload) {

  const schoolId = scopedSchoolId(user);

  const quiz = await one("select id from quizzes where id = $1 and school_id = $2 and is_global = false and deleted_at is null", [quizId, schoolId]);

  if (!quiz) {

    const error = new Error("School quiz not found");

    error.statusCode = 404;

    throw error;

  }

  return transaction(async (client) => {

    const question = await client.query(

      `insert into quiz_questions (school_id, question, option_a, option_b, option_c, option_d, correct_option, is_global)

       values ($1, $2, $3, $4, $5, $6, $7, false)

       returning id, question, option_a, option_b, option_c, option_d, correct_option`,

      [

        schoolId,

        payload.question,

        payload.option_a,

        payload.option_b,

        payload.option_c,

        payload.option_d,

        normalizeCorrectOption(payload.correct_option)

      ]

    );

    const order = await client.query("select coalesce(max(sort_order), 0) + 1 as next_order from quiz_items where quiz_id = $1", [quizId]);

    await client.query("insert into quiz_items (quiz_id, question_id, sort_order) values ($1, $2, $3)", [quizId, question.rows[0].id, order.rows[0].next_order]);

    await recordAudit({

      client,

      actor: user,

      action: "quiz.add_question_school",

      targetType: "quiz",

      targetId: quizId,

      schoolId,

      metadata: { question_id: question.rows[0].id }

    });

    return question.rows[0];

  });

}



async function bulkAddQuestionsToSchoolQuiz(user, quizId, rows) {

  const schoolId = scopedSchoolId(user);

  const created = [];

  const errors = [];

  await transaction(async (client) => {

    const quiz = await client.query("select id from quizzes where id = $1 and school_id = $2 and is_global = false and deleted_at is null", [quizId, schoolId]);

    if (!quiz.rows[0]) {

      const error = new Error("School quiz not found");

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

          `insert into quiz_questions (school_id, question, option_a, option_b, option_c, option_d, correct_option, is_global)

           values ($1, $2, $3, $4, $5, $6, $7, false)

           returning id, question`,

          [schoolId, row.question, row.option_a, row.option_b, row.option_c, row.option_d, normalizeCorrectOption(row.correct_option)]

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

      action: "quiz.bulk_add_questions_school",

      targetType: "quiz",

      targetId: quizId,

      schoolId,

      metadata: { imported: created.length, errors: errors.length }

    });

  });

  return { created, errors };

}



async function assignQuiz(user, quizId, payload) {

  const schoolId = scopedSchoolId(user);

  const grades = normalizeGrades(payload.grades || payload.grade_levels);

  const term = payload.term_id
    ? await one("select id, starts_on, ends_on from terms where id = $1", [payload.term_id])
    : await activeTerm(user);

  const termId = term?.id || null;



  if (!termId) {

    const error = new Error("An active term is required before assigning quizzes");

    error.statusCode = 400;

    throw error;

  }



  const quiz = await one(

    `select id, title, grade_levels, max_attempts, is_global, school_id

     from quizzes

     where id = $1 and deleted_at is null and is_published = true and (is_global = true or school_id = $2)`,

    [quizId, schoolId]

  );

  if (!quiz) {

    const error = new Error("Quiz not found or not available to this school");

    error.statusCode = 404;

    throw error;

  }



  const allowed = (quiz.grade_levels || []).map((grade) => Number(grade));

  const blocked = grades.filter((grade) => !allowed.includes(grade));

  if (blocked.length) {

    const error = new Error(`This quiz is only available to Grade ${allowed.join("-") || "none"}`);

    error.statusCode = 400;

    throw error;

  }

  const availability = payload.week_number
    ? availabilityForWeek(term, payload.week_number)
    : { available_from: payload.available_from || null, available_until: payload.available_until || null };

  if (payload.week_number && !availability) {
    const error = new Error("Selected week is not inside the active term");
    error.statusCode = 400;
    throw error;
  }



  return transaction(async (client) => {

    const assigned = [];

    for (const grade of grades) {

      const result = await client.query(

        `insert into quiz_assignments (quiz_id, school_id, term_id, grade, assigned_by, max_attempts, week_number, available_from, available_until, is_active)

         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)

         on conflict (quiz_id, school_id, term_id, grade) do update set

           max_attempts = excluded.max_attempts,

           available_from = excluded.available_from,

           available_until = excluded.available_until,

           week_number = excluded.week_number,

           is_active = true,

           assigned_by = excluded.assigned_by,

           assigned_at = now()

         returning *`,

        [quizId, schoolId, termId, grade, user.sub, Number(payload.max_attempts || quiz.max_attempts || 1), payload.week_number || null, availability.available_from, availability.available_until]

      );

      assigned.push(result.rows[0]);

    }

    await recordAudit({

      client,

      actor: user,

      action: "quiz.assign",

      targetType: "quiz",

      targetId: quizId,

      schoolId,

      termId,

      metadata: { grades, count: assigned.length, week_number: payload.week_number || null }

    });

    return { assigned, count: assigned.length };

  });

}



async function quizAssignments(user, params = {}) {

  const schoolId = scopedSchoolId(user);

  const termId = params.term_id || null;

  const result = await query(

    `select qa.id, qa.quiz_id, qa.term_id, qa.grade, qa.max_attempts, qa.is_active, qa.available_from, qa.available_until, qa.assigned_at,

            q.title, q.grade_levels, q.is_global, q.total_points,

            count(distinct u.id)::int as learner_count

     from quiz_assignments qa

     join quizzes q on q.id = qa.quiz_id

     left join users u on u.school_id = qa.school_id and u.role = 'student' and u.grade = qa.grade and u.deleted_at is null

     where qa.school_id = $1 and ($2::uuid is null or qa.term_id = $2)

     group by qa.id, q.id

     order by qa.assigned_at desc`,

    [schoolId, termId]

  );

  return result.rows;

}



async function quizPerformance(user, params = {}) {

  const schoolId = scopedSchoolId(user);

  const termId = params.term_id || null;

  const result = await query(

    `select qa.quiz_id, q.title as quiz_title, count(qa.id)::int as attempts,

            avg(qa.score)::numeric as average_score,

            min(qa.score)::numeric as lowest_score,

            max(qa.score)::numeric as highest_score

     from quiz_attempts qa

     left join quizzes q on q.id = qa.quiz_id

     where qa.school_id = $1 and ($2::uuid is null or qa.term_id = $2)

     group by qa.quiz_id, q.title

     order by q.title nulls last`,

    [schoolId, termId]

  );

  return result.rows.map((row) => ({ ...row, expectation: row.average_score === null ? "-" : gradeBand(row.average_score) }));

}



async function leaderboards(user, params = {}) {

  const schoolId = scopedSchoolId(user);

  const { limit, offset } = pagination(params);

  const termId = params.term_id || null;

  return list(

    `with quiz_scores as (

       select qa.learner_id, qa.school_id, qa.term_id, max(qa.score)::numeric as score, max(qa.created_at) as created_at

       from quiz_attempts qa

       where qa.school_id = $1 and ($2::uuid is null or qa.term_id = $2)

       group by qa.learner_id, qa.school_id, qa.term_id

     ),

     quiz_ranked as (

       select concat('quiz-', qs.term_id, '-', qs.learner_id) as id, qs.learner_id, qs.school_id, qs.term_id,

              'quiz'::text as leaderboard_type, qs.score,

              row_number() over (partition by qs.school_id, qs.term_id order by qs.score desc, qs.created_at asc)::int as rank,

              qs.created_at

       from quiz_scores qs

     ),

     typing_ranked as (

       select concat('typing-', ts.term_id, '-', ts.learner_id) as id, ts.learner_id, ts.school_id, ts.term_id,

              'typing'::text as leaderboard_type, ts.score,

              row_number() over (partition by ts.school_id, ts.term_id order by ts.score desc, ts.accuracy desc, ts.created_at asc)::int as rank,

              ts.created_at

       from (

         select distinct on (learner_id, school_id, term_id)

                learner_id, school_id, term_id, wpm::numeric as score, accuracy::numeric as accuracy, created_at

         from (

           select learner_id, school_id, term_id, wpm, accuracy, created_at from typing_results

           union all

           select learner_id, school_id, term_id, wpm, accuracy, created_at from typing_attempts

         ) typing_source

         where school_id = $1 and ($2::uuid is null or term_id = $2)

         order by learner_id, school_id, term_id, wpm desc, accuracy desc, created_at asc

       ) ts

     ),

     stored_ranked as (

       select le.id::text, le.learner_id, le.school_id, le.term_id, le.leaderboard_type, le.score, le.rank, le.created_at

       from leaderboard_entries le

       where le.school_id = $1 and ($2::uuid is null or le.term_id = $2) and le.leaderboard_type not in ('quiz', 'typing')

     ),

     combined as (

       select * from stored_ranked

       union all select * from quiz_ranked

       union all select * from typing_ranked

     )

     select c.id, c.learner_id, c.term_id, c.leaderboard_type, c.score, c.rank, c.created_at,

            coalesce(u.full_name, u.name) as learner_name, u.grade, u.stream

     from combined c

     join users u on u.id = c.learner_id

     order by c.leaderboard_type, c.rank asc, coalesce(u.full_name, u.name)

     limit $3 offset $4`,

    [schoolId, termId, limit, offset],

    `select (

       (select count(*) from leaderboard_entries where school_id = $1 and ($2::uuid is null or term_id = $2) and leaderboard_type not in ('quiz', 'typing')) +

       (select count(*) from (select learner_id, term_id from quiz_attempts where school_id = $1 and ($2::uuid is null or term_id = $2) group by learner_id, term_id) q) +

       (select count(*) from (

         select learner_id, term_id

         from (

           select learner_id, school_id, term_id from typing_results

           union all

           select learner_id, school_id, term_id from typing_attempts

         ) typing_source

         where school_id = $1 and ($2::uuid is null or term_id = $2)

         group by learner_id, term_id

       ) t)

     ) as count`,

    [schoolId, termId]

  );

}



async function preferences(user) {

  const schoolId = scopedSchoolId(user);

  return one(

    `select sp.*, s.name as school_name, s.logo_url, s.clubs

     from school_preferences sp

     join schools s on s.id = sp.school_id

     where sp.school_id = $1`,

    [schoolId]

  );

}



async function ensurePreferences(user) {

  const schoolId = scopedSchoolId(user);

  return one(

    `insert into school_preferences (school_id)

     values ($1)

     on conflict (school_id) do update set updated_at = school_preferences.updated_at

     returning *`,

    [schoolId]

  );

}



async function updatePreferences(user, payload) {

  const schoolId = scopedSchoolId(user);

  const updated = await one(

    `insert into school_preferences (

       school_id, typing_passage_words, typing_timer_seconds, module_pass_threshold,

       leaderboards_visible, ai_enabled, notification_preferences, report_header_fields

     )

     values ($1, $2, $3, $4, $5, $6, $7, $8)

     on conflict (school_id) do update set

       typing_passage_words = excluded.typing_passage_words,

       typing_timer_seconds = excluded.typing_timer_seconds,

       module_pass_threshold = excluded.module_pass_threshold,

       leaderboards_visible = excluded.leaderboards_visible,

       ai_enabled = excluded.ai_enabled,

       notification_preferences = excluded.notification_preferences,

       report_header_fields = excluded.report_header_fields,

       updated_at = now()

     returning *`,

    [

      schoolId,

      payload.typing_passage_words,

      payload.typing_timer_seconds,

      payload.module_pass_threshold,

      Boolean(payload.leaderboards_visible),

      Boolean(payload.ai_enabled),

      payload.notification_preferences || {},

      payload.report_header_fields || {}

    ]

  );

  await recordAudit({

    actor: user,

    action: "school.preferences_update",

    targetType: "school",

    targetId: schoolId,

    schoolId

  });

  return updated;

}



async function streams(user) {

  const schoolId = scopedSchoolId(user);

  const result = await query(

    "select id, grade, name, created_at from school_streams where school_id = $1 order by grade nulls first, name",

    [schoolId]

  );

  return result.rows;

}



async function addStream(user, payload) {

  const schoolId = scopedSchoolId(user);

  const stream = await one(

    `insert into school_streams (school_id, grade, name)

     values ($1, null, $2)

     returning *`,

    [schoolId, payload.name]

  );

  await recordAudit({

    actor: user,

    action: "school.stream_create",

    targetType: "school",

    targetId: schoolId,

    schoolId,

    metadata: { stream: stream.name }

  });

  return stream;

}



async function deleteStream(user, streamId) {

  const schoolId = scopedSchoolId(user);

  const stream = await one("select * from school_streams where id = $1 and school_id = $2", [streamId, schoolId]);

  if (!stream) return null;

  const activeLearners = await one(

    `select count(*)::int as count from users

     where school_id = $1 and role = 'student' and deleted_at is null and stream = $2`,

    [schoolId, stream.name]

  );

  if (activeLearners.count > 0) {

    const error = new Error("Stream cannot be deleted while active learners are assigned");

    error.statusCode = 409;

    throw error;

  }

  return one("delete from school_streams where id = $1 and school_id = $2 returning *", [streamId, schoolId]);

}



function averageNumber(rows, key) {

  const values = rows.map((row) => Number(row[key])).filter((value) => Number.isFinite(value));

  if (!values.length) return null;

  return values.reduce((sum, value) => sum + value, 0) / values.length;

}



async function learnerDetail(user, learnerId, params = {}) {

  const schoolId = scopedSchoolId(user);

  const [learner, term, school] = await Promise.all([

    one(

    `select id, coalesce(full_name, name) as full_name, username, grade, stream, parent_name, parent_email, parent_phone,

            is_active, created_at, last_login_at

     from users

     where id = $1 and school_id = $2 and role = 'student' and deleted_at is null`,

    [learnerId, schoolId]

    ),

    params.term_id ? one(

      `select t.id, coalesce(t.label, t.name::text) as name, t.starts_on, t.ends_on, ay.year

       from terms t join academic_years ay on ay.id = t.academic_year_id

       where t.id = $1`,

      [params.term_id]

    ) : activeTerm(user),

    one("select id, name, logo_url from schools where id = $1", [schoolId])

  ]);

  if (!learner) {

    const error = new Error("Learner not found");

    error.statusCode = 404;

    throw error;

  }

  const learnerProfile = await one(

    "select id from learner_profiles where user_id = $1 and school_id = $2",

    [learnerId, schoolId]

  );

  const enrolmentLearnerIds = [learnerId, learnerProfile?.id].filter(Boolean);

  const termId = term?.id || null;



  const [enrolments, submissions, reports, typing, quizzes, progress, quizTrend, typingTrend] = await Promise.all([

    query(

      `select e.id, e.status, e.created_at, coalesce(c.name, c.title) as course_name, coalesce(t.label, t.name::text) as term_name, ay.year

       from enrolments e

       join courses c on c.id = e.course_id

       join terms t on t.id = e.term_id

       join academic_years ay on ay.id = t.academic_year_id

       where e.school_id = $1 and e.learner_id = any($2::uuid[]) and ($3::uuid is null or e.term_id = $3)

       order by ay.year desc, t.starts_on desc`,

      [schoolId, enrolmentLearnerIds, termId]

    ),

    query(

      `select id, file_url, status, feedback, reviewed_at, created_at

       from submissions

       where school_id = $1 and learner_id = $2 and ($3::uuid is null or term_id = $3)

       order by created_at desc`,

      [schoolId, learnerId, termId]

    ),

    query(

      `select rc.id, rc.pdf_url, rc.teacher_remarks, rc.snapshot, rc.published_at, rc.created_at, coalesce(t.label, t.name::text) as term_name, ay.year

       from report_cards rc

       join terms t on t.id = rc.term_id

       join academic_years ay on ay.id = t.academic_year_id

       where rc.school_id = $1 and rc.learner_id = $2 and ($3::uuid is null or rc.term_id = $3)

       order by ay.year desc, t.starts_on desc`,

      [schoolId, learnerId, termId]

    ),

    query(

      `select tr.id, tr.wpm, tr.accuracy, tr.time_taken_seconds, tr.created_at, tt.title as test_title,

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

      [schoolId, learnerId, termId]

    ),

    query(

      `select qa.id, qa.score, qa.time_taken_seconds, qa.created_at, q.title as quiz_title, coalesce(t.label, t.name::text) as term_name, ay.year

       from quiz_attempts qa

       left join quizzes q on q.id = qa.quiz_id

       join terms t on t.id = qa.term_id

       join academic_years ay on ay.id = t.academic_year_id

       where qa.school_id = $1 and qa.learner_id = $2 and ($3::uuid is null or qa.term_id = $3)

       order by qa.created_at desc`,

      [schoolId, learnerId, termId]

    ),

    query(

      `select coalesce(c.name, c.title) as course_name, m.title as module_name, l.title as lesson_name, lp.score, lp.completed_at, lp.updated_at

       from lesson_progress lp

       join courses c on c.id = lp.course_id

       join modules m on m.id = lp.module_id

       join lessons l on l.id = lp.lesson_id

       where lp.learner_id = $1

       order by lp.updated_at desc`,

      [learnerId]

    ),

    query(

      `select date_trunc('week', qa.created_at)::date as week_start,

              avg(qa.score)::numeric as average_score,

              count(*)::int as attempts

       from quiz_attempts qa

       where qa.school_id = $1 and qa.learner_id = $2 and ($3::uuid is null or qa.term_id = $3)

       group by date_trunc('week', qa.created_at)::date

       order by week_start`,

      [schoolId, learnerId, termId]

    ),

    query(

      `select date_trunc('week', ta.created_at)::date as week_start,

              avg(ta.wpm)::numeric as average_wpm,

              avg(ta.accuracy)::numeric as average_accuracy,

              count(*)::int as attempts

       from typing_attempts ta

       where ta.school_id = $1 and ta.learner_id = $2 and ($3::uuid is null or ta.term_id = $3)

       group by date_trunc('week', ta.created_at)::date

       order by week_start`,

      [schoolId, learnerId, termId]

    )

  ]);



  const typingWeekly = typingTrend.rows.map((row, index) => ({

    week: index + 1,

    wpm: Math.round(Number(row.average_wpm || 0)),

    accuracy: Math.round(Number(row.average_accuracy || 0))

  }));



  const quizWeekly = quizTrend.rows.map((row, index) => ({

    week: index + 1,

    score: Math.round(Number(row.average_score || 0))

  }));



  const quizAvg = averageNumber(quizzes.rows, "score");

  const typingAvg = averageNumber(typing.rows, "wpm");

  const overallPerformance = (() => {

    if (quizAvg == null && typingAvg == null) return "Approaching Expectation";

    const quizNorm = quizAvg != null ? quizAvg : 0;

    const typingNorm = typingAvg != null ? Math.min(typingAvg / 50 * 100, 100) : 0;

    const combined = (quizNorm * 0.6) + (typingNorm * 0.4);

    if (combined <= 50) return "Approaching Expectation";

    if (combined <= 80) return "Meets Expectation";

    return "Exceeds Expectation";

  })();



  const modulePerformance = {};

  for (const item of progress.rows) {

    if (!item.module_name) continue;

    const score = Number(item.score);

    if (!Number.isFinite(score)) continue;

    if (!modulePerformance[item.module_name]) {

      modulePerformance[item.module_name] = { total: 0, count: 0, course_name: item.course_name };

    }

    modulePerformance[item.module_name].total += score;

    modulePerformance[item.module_name].count += 1;

  }



  const courseModules = Object.entries(modulePerformance).map(([name, data]) => {

    const avg = data.total / data.count;

    let performance;

    if (avg <= 50) performance = "APPROACHING";

    else if (avg <= 80) performance = "MEETING";

    else performance = "EXCEEDING";

    return { name, description: "", performance };

  });



  const primaryCourseName = enrolments.rows[0]?.course_name || "Course";



  const course = {

    name: primaryCourseName,

    modules: courseModules.length

      ? courseModules

      : [{ name: "No modules started", description: "Complete lessons to see module performance.", performance: "APPROACHING" }]

  };



  const report = {

    learner,

    school,

    term,

    courses: enrolments.rows,

    typing_summary: {

      attempts: typing.rows.length,

      average_wpm: typingAvg,

      average_accuracy: averageNumber(typing.rows, "accuracy")

    },

    quiz_summary: {

      attempts: quizzes.rows.length,

      average_score: quizAvg

    },

    lesson_progress: progress.rows,

    weekly_quiz_trend: quizTrend.rows,

    submissions: submissions.rows,

    teacher_remarks: reports.rows[0]?.teacher_remarks || null,

    published_report: reports.rows[0] || null,

    overall_performance: overallPerformance

  };



  return {

    learner,

    school,

    selected_term: term,

    course_history: enrolments.rows,

    submissions: submissions.rows,

    reports: reports.rows,

    typing_results: typing.rows,

    quiz_results: quizzes.rows,

    lesson_progress: progress.rows,

    weekly_quiz_trend: quizTrend.rows,

    typing_weekly: typingWeekly,

    quiz_weekly: quizWeekly,

    course,

    report

  };

}



async function availableCourses(user) {

  scopedSchoolId(user);

  await ensureDefaultCourses({ query });

  const result = await query(

    `select c.id, coalesce(c.name, c.title) as name, c.club, coalesce(c.objectives, c.description) as objectives,
            c.cover_image_url, c.is_coming_soon,

            coalesce(json_agg(json_build_object('id', m.id, 'name', coalesce(m.name, m.title), 'sort_order', m.sort_order) order by m.sort_order) filter (where m.id is not null), '[]'::json) as modules

     from courses c

     left join modules m on m.course_id = c.id

     where c.deleted_at is null and (c.is_published = true or c.status = 'published')

     group by c.id

     order by coalesce(c.name, c.title)`

  );

  return result.rows;

}



async function bulkAllocateCourse(user, payload) {

  const schoolId = scopedSchoolId(user);

  const term = payload.term_id
    ? await one("select id, starts_on, ends_on from terms where id = $1", [payload.term_id])
    : await activeTerm(user);

  const termId = term?.id || null;



  if (!termId) {

    const error = new Error("An active term is required before allocating learners to a course");

    error.statusCode = 400;

    throw error;

  }

  if (!payload.course_id || !Array.isArray(payload.learner_ids) || payload.learner_ids.length === 0) {

    const error = new Error("Course and at least one learner are required");

    error.statusCode = 400;

    throw error;

  }



  return transaction(async (client) => {
    await ensureLearnerProfilesSchema(client);

    const enrolmentLearnerTable = await enrolmentLearnerReferenceTable(client);

    const inserted = [];

    for (const learnerId of payload.learner_ids) {

      const learnerCheck = await client.query(

        `select u.id, coalesce(u.full_name, u.name) as full_name, u.grade, u.stream, u.parent_name, u.parent_email, u.parent_phone, lp.id as profile_id

         from users u

         left join learner_profiles lp on lp.user_id = u.id and lp.school_id = u.school_id

         where u.id = $1 and u.school_id = $2 and u.role = 'student' and u.deleted_at is null`,

        [learnerId, schoolId]

      );

      if (learnerCheck.rows.length === 0) continue;

      const learner = learnerCheck.rows[0];

      let profileId = learner.profile_id;

      if (!profileId) {

        const profile = await upsertLearnerProfile(client, schoolId, learner);

        profileId = profile.id;

      }

      const enrolmentLearnerId = enrolmentLearnerTable === "learner_profiles" ? profileId : learner.id;

      const result = await client.query(

        `insert into enrolments (learner_id, school_id, course_id, term_id, status)

         values ($1, $2, $3, $4, 'active')

         on conflict (term_id, learner_id, course_id) do update set status = 'active'

         returning id, learner_id, course_id, term_id, status`,

        [enrolmentLearnerId, schoolId, payload.course_id, termId]

      );

      inserted.push(result.rows[0]);

    }

    const moduleAvailability = payload.module_availability || {};
    const moduleWeeks = payload.module_weeks || {};

    const moduleIds = [...new Set([...Object.keys(moduleAvailability), ...Object.keys(moduleWeeks)])];

    for (const moduleId of moduleIds) {
      const availableFrom = moduleAvailability[moduleId];
      const weekOpenDate = moduleWeeks[moduleId]
        ? moduleOpenDateForWeek(term, moduleWeeks[moduleId])
        : null;

      if (moduleWeeks[moduleId] && !weekOpenDate) {
        const error = new Error("Selected module week is not inside the active term");
        error.statusCode = 400;
        throw error;
      }

      await client.query(

        `insert into course_module_availability (school_id, term_id, course_id, module_id, week_number, available_from, created_by)

         values ($1, $2, $3, $4, $5, $6, $7)

         on conflict (school_id, module_id) do update set

           available_from = excluded.available_from,

           term_id = excluded.term_id,

           week_number = excluded.week_number,

           updated_at = now()`,

        [schoolId, termId, payload.course_id, moduleId, moduleWeeks[moduleId] || null, weekOpenDate || availableFrom || null, user.sub]

      );

    }

    await recordAudit({

      client,

      actor: user,

      action: "course.bulk_allocate",

      targetType: "course",

      targetId: payload.course_id,

      schoolId,

      termId,

      metadata: { learners: inserted.length }

    });

    return { allocated: inserted, count: inserted.length };

  });

}



async function deallocateCourse(user, courseId, payload = {}) {

  const schoolId = scopedSchoolId(user);

  const term = payload.term_id ? { id: payload.term_id } : await activeTerm(user);

  const termId = term?.id || null;



  if (!termId) {

    const error = new Error("An active term is required before deallocating a course");

    error.statusCode = 400;

    throw error;

  }



  return transaction(async (client) => {

    const result = await client.query(

      `update enrolments

       set status = 'inactive'

       where school_id = $1 and course_id = $2 and term_id = $3 and status = 'active'

       returning id, learner_id, course_id, term_id, status`,

      [schoolId, courseId, termId]

    );

    await recordAudit({

      client,

      actor: user,

      action: "course.deallocate",

      targetType: "course",

      targetId: courseId,

      schoolId,

      termId,

      metadata: { learners: result.rows.length }

    });

    return { deallocated: result.rows, count: result.rows.length };

  });

}



module.exports = {

  assertSchoolAdmin,

  profile,

  activeTerm,

  terms,

  termWeeks,

  dashboardSummary,

  enrolmentByCourse,

  classProgress,

  listLearners,

  learnerDetail,

  addLearner,

  bulkImportLearners,

  updateLearner,

  setLearnerActive,

  promoteLearner,

  listSubmissions,

  reviewSubmission,

  typingResults,

  globalTypingTests,

  schoolTypingTests,

  createSchoolTypingTest,

  updateSchoolTypingTest,

  assignTypingTest,

  typingAssignments,

  typingPerformance,

  quizResults,

  globalQuizzes,

  schoolQuizzes,

  createSchoolQuiz,

  addQuestionToSchoolQuiz,

  bulkAddQuestionsToSchoolQuiz,

  assignQuiz,

  quizAssignments,

  quizPerformance,

  leaderboards,

  preferences,

  ensurePreferences,

  updatePreferences,

  streams,

  addStream,

  deleteStream,

  availableCourses,

  courseCertificateLearners,

  bulkAllocateCourse,

  deallocateCourse

};

