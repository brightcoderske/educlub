const { query, one, transaction } = require("../config/database");
const { assertSystemAdmin } = require("./systemAdmin.service");
const { ensureCourseBuilderSchema } = require("../utils/schemaGuard");

const ACTIVITY_TYPE_SET = new Set([
  "learn_content",
  "practice",
  "creative_corner",
  "teacher_task",
  "quiz",
  "submission"
]);

function defaultPayload(type) {
  switch (type) {
    case "learn_content":
      return { richText: "", images: [], videoUrls: [], codeExample: "", teacherNotes: "" };
    case "practice":
      return { language: "python", instructions: "", starterCode: "", expectedHints: "" };
    case "creative_corner":
      return { instructions: "" };
    case "teacher_task":
      return { instructions: "", expectedOutputDescription: "" };
    case "quiz":
      return {
        questions: [{ type: "mcq", question: "", options: ["", "", "", ""], correctIndex: 0, marks: 10 }]
      };
    case "submission":
      return {
        instructions: "",
        allowCode: true,
        allowText: true,
        allowFile: true,
        allowLink: true,
        allowScreenshot: false
      };
    default:
      return {};
  }
}

async function ensure() {
  await ensureCourseBuilderSchema({ query });
}

async function getBlueprint(courseId, user) {
  assertSystemAdmin(user);
  await ensure();
  const course = await one(
    `select id, coalesce(name, title) as name, title, description, short_description, objectives, club, status,
            is_published, is_coming_soon, published_at, cover_image_url, target_level, technology, created_at, updated_at
     from courses where id = $1 and deleted_at is null`,
    [courseId]
  );
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }
  const modules = await query(
    `select id, course_id, coalesce(name, title) as name, coalesce(title, name) as title, description, objectives,
            sort_order, icon_url, total_marks, badge_name, xp_points, available_from
     from modules where course_id = $1 order by sort_order, created_at`,
    [courseId]
  );
  const moduleIds = modules.rows.map((m) => m.id);
  let lessons = { rows: [] };
  if (moduleIds.length) {
    lessons = await query(
      `select l.id, l.module_id, coalesce(l.name, l.title) as name, coalesce(l.title, l.name) as title,
              l.description, l.lesson_objectives, l.learning_notes, l.sort_order, l.total_marks, l.video_url,
              l.practice_prompt, l.starter_code, l.homework_prompt, l.creativity_prompt, l.quiz, l.content
       from lessons l where l.module_id = any($1::uuid[]) order by l.module_id, l.sort_order, l.created_at`,
      [moduleIds]
    );
  }
  const lessonIds = lessons.rows.map((l) => l.id);
  let blocks = { rows: [] };
  if (lessonIds.length) {
    blocks = await query(
      `select id, lesson_id, activity_type, sort_order, marks_weight, payload, created_at, updated_at
       from lesson_activity_blocks where lesson_id = any($1::uuid[]) order by lesson_id, sort_order, created_at`,
      [lessonIds]
    );
  }
  const blockByLesson = {};
  for (const b of blocks.rows) {
    if (!blockByLesson[b.lesson_id]) blockByLesson[b.lesson_id] = [];
    blockByLesson[b.lesson_id].push(b);
  }
  const lessonsByModule = {};
  for (const lesson of lessons.rows) {
    if (!lessonsByModule[lesson.module_id]) lessonsByModule[lesson.module_id] = [];
    lessonsByModule[lesson.module_id].push({
      ...lesson,
      activity_blocks: blockByLesson[lesson.id] || []
    });
  }
  return {
    course,
    modules: modules.rows.map((m) => ({
      ...m,
      lessons: lessonsByModule[m.id] || []
    }))
  };
}

async function patchCourse(courseId, payload, user) {
  assertSystemAdmin(user);
  await ensure();
  const exists = await one("select id from courses where id = $1 and deleted_at is null", [courseId]);
  if (!exists) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }
  const title = payload.title ?? payload.name;
  const name = payload.name ?? payload.title;
  await query(
    `update courses set
       title = coalesce($2, title),
       name = coalesce($3, name),
       description = coalesce($4, description),
       short_description = coalesce($5, short_description),
       objectives = coalesce($6, objectives),
       club = coalesce($7, club),
       cover_image_url = coalesce($8, cover_image_url),
       target_level = coalesce($9, target_level),
       technology = coalesce($10, technology),
       status = coalesce($11, status),
       updated_at = now()
     where id = $1`,
    [
      courseId,
      title ?? null,
      name ?? null,
      payload.description ?? null,
      payload.short_description ?? null,
      payload.objectives ?? null,
      payload.club ?? null,
      payload.cover_image_url ?? null,
      payload.target_level ?? null,
      payload.technology ?? null,
      payload.status ?? null
    ]
  );
  return getBlueprint(courseId, user);
}

async function createModule(courseId, payload, user) {
  assertSystemAdmin(user);
  await ensure();
  const c = await one("select id from courses where id = $1 and deleted_at is null", [courseId]);
  if (!c) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }
  const title = payload.title || payload.name || "New module";
  const row = await one(
    `insert into modules (course_id, name, title, description, objectives, sort_order, icon_url, total_marks, badge_name, xp_points)
     values ($1, $2, $2, $3, $4,
       (select coalesce(max(sort_order), 0) + 1 from modules m2 where m2.course_id = $1),
       $5, coalesce($6, 100), $7, coalesce($8, 50))
     returning id, course_id, coalesce(name, title) as name, sort_order`,
    [
      courseId,
      title,
      payload.description || null,
      payload.objectives || payload.description || null,
      payload.icon_url || null,
      payload.total_marks != null ? Number(payload.total_marks) : null,
      payload.badge_name || null,
      payload.xp_points != null ? Number(payload.xp_points) : null
    ]
  );
  return row;
}

async function updateModule(moduleId, payload, user) {
  assertSystemAdmin(user);
  await ensure();
  const row = await one(
    `update modules set
       name = coalesce($2, name),
       title = coalesce($3, title),
       description = coalesce($4, description),
       objectives = coalesce($5, objectives),
       icon_url = coalesce($6, icon_url),
       total_marks = coalesce($7, total_marks),
       badge_name = coalesce($8, badge_name),
       xp_points = coalesce($9, xp_points),
       available_from = coalesce($10, available_from),
       updated_at = now()
     where id = $1
     returning id, course_id, coalesce(name, title) as name, sort_order`,
    [
      moduleId,
      payload.name ?? null,
      payload.title ?? payload.name ?? null,
      payload.description ?? null,
      payload.objectives ?? null,
      payload.icon_url ?? null,
      payload.total_marks != null ? Number(payload.total_marks) : null,
      payload.badge_name ?? null,
      payload.xp_points != null ? Number(payload.xp_points) : null,
      payload.available_from ?? null
    ]
  );
  if (!row) {
    const error = new Error("Module not found");
    error.statusCode = 404;
    throw error;
  }
  return row;
}

async function deleteModule(moduleId, user) {
  assertSystemAdmin(user);
  await ensure();
  const mod = await one("delete from modules where id = $1 returning course_id", [moduleId]);
  if (!mod) {
    const error = new Error("Module not found");
    error.statusCode = 404;
    throw error;
  }
  return { course_id: mod.course_id };
}

async function reorderModules(courseId, orderedIds, user) {
  assertSystemAdmin(user);
  await ensure();
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    return { ok: true };
  }
  const rows = await query("select id from modules where course_id = $1", [courseId]);
  const set = new Set(rows.rows.map((r) => r.id));
  for (const id of orderedIds) {
    if (!set.has(id)) {
      const error = new Error("Invalid module id for this course");
      error.statusCode = 400;
      throw error;
    }
  }
  await transaction(async (client) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await client.query("update modules set sort_order = $1, updated_at = now() where id = $2", [i + 10000, orderedIds[i]]);
    }
    for (let i = 0; i < orderedIds.length; i += 1) {
      await client.query("update modules set sort_order = $1, updated_at = now() where id = $2", [i + 1, orderedIds[i]]);
    }
  });
  return { ok: true };
}

async function createLesson(moduleId, payload, user) {
  assertSystemAdmin(user);
  await ensure();
  const mod = await one("select id, course_id from modules where id = $1", [moduleId]);
  if (!mod) {
    const error = new Error("Module not found");
    error.statusCode = 404;
    throw error;
  }
  const title = payload.title || payload.name || "New lesson";
  const row = await one(
    `insert into lessons (module_id, name, title, description, lesson_objectives, content, learning_notes, sort_order, total_marks, video_url)
     values ($1, $2, $2, $3, $4, coalesce($5::jsonb, '{}'::jsonb), $6,
       (select coalesce(max(sort_order), 0) + 1 from lessons l2 where l2.module_id = $1),
       coalesce($7, 100), $8)
     returning id, module_id, coalesce(name, title) as name, sort_order`,
    [
      moduleId,
      title,
      payload.description || null,
      payload.lesson_objectives || null,
      payload.content_json ? JSON.stringify(payload.content_json) : null,
      payload.learning_notes || null,
      payload.total_marks != null ? Number(payload.total_marks) : null,
      payload.video_url || null
    ]
  );
  return row;
}

async function updateLesson(lessonId, payload, user) {
  assertSystemAdmin(user);
  await ensure();
  const row = await one(
    `update lessons set
       name = coalesce($2, name),
       title = coalesce($3, title),
       description = coalesce($4, description),
       lesson_objectives = coalesce($5, lesson_objectives),
       learning_notes = coalesce($6, learning_notes),
       practice_prompt = coalesce($7, practice_prompt),
       starter_code = coalesce($8, starter_code),
       homework_prompt = coalesce($9, homework_prompt),
       creativity_prompt = coalesce($10, creativity_prompt),
       total_marks = coalesce($11, total_marks),
       video_url = coalesce($12, video_url),
       content = case when $13::jsonb is null then content else $13::jsonb end,
       updated_at = now()
     where id = $1
     returning id, module_id, coalesce(name, title) as name, sort_order`,
    [
      lessonId,
      payload.name ?? null,
      payload.title ?? null,
      payload.description ?? null,
      payload.lesson_objectives ?? null,
      payload.learning_notes ?? null,
      payload.practice_prompt ?? null,
      payload.starter_code ?? null,
      payload.homework_prompt ?? null,
      payload.creativity_prompt ?? null,
      payload.total_marks != null ? Number(payload.total_marks) : null,
      payload.video_url ?? null,
      payload.content_json != null ? JSON.stringify(payload.content_json) : null
    ]
  );
  if (!row) {
    const error = new Error("Lesson not found");
    error.statusCode = 404;
    throw error;
  }
  return row;
}

async function deleteLesson(lessonId, user) {
  assertSystemAdmin(user);
  await ensure();
  const row = await one("delete from lessons where id = $1 returning id, module_id", [lessonId]);
  if (!row) {
    const error = new Error("Lesson not found");
    error.statusCode = 404;
    throw error;
  }
  const mod = await one("select course_id from modules where id = $1", [row.module_id]);
  return { module_id: row.module_id, course_id: mod?.course_id };
}

async function reorderLessons(moduleId, orderedIds, user) {
  assertSystemAdmin(user);
  await ensure();
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    return { ok: true };
  }
  const rows = await query("select id from lessons where module_id = $1", [moduleId]);
  const set = new Set(rows.rows.map((r) => r.id));
  for (const id of orderedIds) {
    if (!set.has(id)) {
      const error = new Error("Invalid lesson id for this module");
      error.statusCode = 400;
      throw error;
    }
  }
  await transaction(async (client) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await client.query("update lessons set sort_order = $1, updated_at = now() where id = $2", [i + 10000, orderedIds[i]]);
    }
    for (let i = 0; i < orderedIds.length; i += 1) {
      await client.query("update lessons set sort_order = $1, updated_at = now() where id = $2", [i + 1, orderedIds[i]]);
    }
  });
  return { ok: true };
}

async function createActivityBlock(lessonId, payload, user) {
  assertSystemAdmin(user);
  await ensure();
  const lesson = await one("select id from lessons where id = $1", [lessonId]);
  if (!lesson) {
    const error = new Error("Lesson not found");
    error.statusCode = 404;
    throw error;
  }
  const type = String(payload.activity_type || "");
  if (!ACTIVITY_TYPE_SET.has(type)) {
    const error = new Error("Invalid activity_type");
    error.statusCode = 400;
    throw error;
  }
  const marks = payload.marks_weight != null ? Number(payload.marks_weight) : 0;
  const payloadJson = { ...defaultPayload(type), ...(payload.payload || {}) };
  const row = await one(
    `insert into lesson_activity_blocks (lesson_id, activity_type, sort_order, marks_weight, payload)
     values ($1, $2,
       (select coalesce(max(sort_order), 0) + 1 from lesson_activity_blocks b2 where b2.lesson_id = $1),
       $3, $4::jsonb)
     returning id, lesson_id, activity_type, sort_order, marks_weight, payload`,
    [lessonId, type, marks, JSON.stringify(payloadJson)]
  );
  return row;
}

async function updateActivityBlock(blockId, payload, user) {
  assertSystemAdmin(user);
  await ensure();
  const existing = await one("select id, lesson_id from lesson_activity_blocks where id = $1", [blockId]);
  if (!existing) {
    const error = new Error("Activity block not found");
    error.statusCode = 404;
    throw error;
  }
  if (payload.activity_type != null && !ACTIVITY_TYPE_SET.has(payload.activity_type)) {
    const error = new Error("Invalid activity_type");
    error.statusCode = 400;
    throw error;
  }
  const marks = payload.marks_weight != null ? Number(payload.marks_weight) : undefined;
  const row = await one(
    `update lesson_activity_blocks set
       activity_type = coalesce($2, activity_type),
       marks_weight = coalesce($3, marks_weight),
       payload = case when $4::jsonb is null then payload else $4::jsonb end,
       updated_at = now()
     where id = $1
     returning id, lesson_id, activity_type, sort_order, marks_weight, payload`,
    [
      blockId,
      payload.activity_type != null && ACTIVITY_TYPE_SET.has(payload.activity_type) ? payload.activity_type : null,
      marks != null && !Number.isNaN(marks) ? marks : null,
      payload.payload != null ? JSON.stringify(payload.payload) : null
    ]
  );
  return row;
}

async function deleteActivityBlock(blockId, user) {
  assertSystemAdmin(user);
  await ensure();
  const row = await one("delete from lesson_activity_blocks where id = $1 returning lesson_id", [blockId]);
  if (!row) {
    const error = new Error("Activity block not found");
    error.statusCode = 404;
    throw error;
  }
  return { ok: true };
}

async function reorderActivityBlocks(lessonId, orderedIds, user) {
  assertSystemAdmin(user);
  await ensure();
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    return { ok: true };
  }
  const rows = await query("select id from lesson_activity_blocks where lesson_id = $1", [lessonId]);
  const set = new Set(rows.rows.map((r) => r.id));
  for (const id of orderedIds) {
    if (!set.has(id)) {
      const error = new Error("Invalid activity block for this lesson");
      error.statusCode = 400;
      throw error;
    }
  }
  await transaction(async (client) => {
    for (let i = 0; i < orderedIds.length; i += 1) {
      await client.query("update lesson_activity_blocks set sort_order = $1, updated_at = now() where id = $2", [
        i + 10000,
        orderedIds[i]
      ]);
    }
    for (let i = 0; i < orderedIds.length; i += 1) {
      await client.query("update lesson_activity_blocks set sort_order = $1, updated_at = now() where id = $2", [i + 1, orderedIds[i]]);
    }
  });
  return { ok: true };
}

module.exports = {
  getBlueprint,
  patchCourse,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  createActivityBlock,
  updateActivityBlock,
  deleteActivityBlock,
  reorderActivityBlocks,
  ACTIVITY_TYPES: Array.from(ACTIVITY_TYPE_SET)
};
