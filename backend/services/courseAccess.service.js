const { one, query } = require("../config/database");

// Central course permission helpers.
// The system requirements define active-term allocated courses as the learner's
// access boundary, so course views and progress writes should pass through here.

function requesterId(user) {
  return user?.sub || user?.id || null;
}

function isAdmin(user) {
  return user?.role === "system_admin" || user?.role === "school_admin";
}

async function findActiveEnrollment({ courseId, learnerId, schoolId }) {
  return one(
    `select e.id, e.learner_id, e.school_id, e.course_id, e.term_id, e.status
     from enrolments e
     left join learner_profiles lp on lp.user_id = $2 and lp.school_id = e.school_id
     where e.course_id = $1
       and e.learner_id = any(array_remove(array[$2::uuid, lp.id], null::uuid))
       and ($3::uuid is null or e.school_id = $3)
       and e.status = 'active'
     order by e.created_at desc
     limit 1`,
    [courseId, learnerId, schoolId || null]
  );
}

async function requireCourseViewAccess(courseId, user) {
  if (isAdmin(user)) return null;

  const enrollment = await findActiveEnrollment({
    courseId,
    learnerId: requesterId(user),
    schoolId: user.school_id
  });

  if (!enrollment) {
    const error = new Error("Course is not allocated to you for this term");
    error.statusCode = 403;
    throw error;
  }

  return enrollment;
}

function requireOwnLearnerAccess(user, learnerId, action) {
  if (isAdmin(user)) return;
  if (requesterId(user) === learnerId) return;

  const error = new Error(`Unauthorized to ${action}`);
  error.statusCode = 403;
  throw error;
}

async function requireActiveCourseEnrollment(courseId, learnerId, user) {
  const enrollment = await findActiveEnrollment({
    courseId,
    learnerId,
    schoolId: isAdmin(user) ? null : user.school_id
  });

  if (!enrollment) {
    const error = new Error("Not enrolled in this course");
    error.statusCode = 403;
    throw error;
  }

  return enrollment;
}

async function completedCourseProgress(courseId, learnerId) {
  const progress = await one(
    `select
       coalesce(jsonb_agg(lp.lesson_id) filter (where lp.completed_at is not null), '[]'::jsonb) as completed_lessons,
       coalesce(sum(coalesce(lp.score, 0)), 0) as total_score
     from enrolments e
     left join lesson_progress lp on lp.course_id = e.course_id and lp.learner_id = e.learner_id
     where e.course_id = $1 and e.learner_id = $2 and e.status = 'active'`,
    [courseId, learnerId]
  );

  return {
    completed_lessons: progress?.completed_lessons || [],
    completed_activities: [],
    total_score: Number(progress?.total_score || 0)
  };
}

async function markLessonCompleted(courseId, lessonId, learnerId) {
  const lesson = await one(
    `select l.id, l.module_id, m.course_id
     from lessons l
     join modules m on m.id = l.module_id
     where l.id = $1 and m.course_id = $2`,
    [lessonId, courseId]
  );

  if (!lesson) {
    const error = new Error("Lesson not found in this course");
    error.statusCode = 404;
    throw error;
  }

  await query(
    `insert into lesson_progress (learner_id, course_id, module_id, lesson_id, completed_at, updated_at)
     values ($1, $2, $3, $4, now(), now())
     on conflict (learner_id, lesson_id) do update set
       completed_at = coalesce(lesson_progress.completed_at, now()),
       updated_at = now()`,
    [learnerId, lesson.course_id, lesson.module_id, lesson.id]
  );
}

module.exports = {
  requesterId,
  isAdmin,
  requireCourseViewAccess,
  requireOwnLearnerAccess,
  requireActiveCourseEnrollment,
  completedCourseProgress,
  markLessonCompleted
};
