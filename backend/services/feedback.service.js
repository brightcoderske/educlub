const { query, one } = require("../config/database");
const { assertSystemAdmin } = require("./systemAdmin.service");
const { addFeedbackSchema } = require("../scripts/addFeedbackSchema");

async function addFeedback(activityBlockId, userId, teacherId, feedback, scoreAdjustment, user) {
  assertSystemAdmin(user);
  await addFeedbackSchema();
  
  const result = await one(`
    INSERT INTO teacher_feedback (activity_block_id, user_id, teacher_id, feedback, score_adjustment)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [activityBlockId, userId, teacherId, feedback, scoreAdjustment]);
  
  return result;
}

async function getFeedbackForUser(activityBlockId, userId, user) {
  assertSystemAdmin(user);
  await addFeedbackSchema();
  
  const result = await query(`
    SELECT tf.*, u.first_name as teacher_first_name, u.last_name as teacher_last_name
    FROM teacher_feedback tf
    INNER JOIN users u ON tf.teacher_id = u.id
    WHERE tf.activity_block_id = $1 AND tf.user_id = $2
    ORDER BY tf.created_at DESC
  `, [activityBlockId, userId]);
  
  return result.rows;
}

async function getFeedbackByTeacher(teacherId, courseId, user) {
  assertSystemAdmin(user);
  await addFeedbackSchema();
  
  const result = await query(`
    SELECT tf.*, u.first_name, u.last_name, l.name as lesson_name, ab.activity_type
    FROM teacher_feedback tf
    INNER JOIN users u ON tf.user_id = u.id
    INNER JOIN lesson_activity_blocks ab ON tf.activity_block_id = ab.id
    INNER JOIN lessons l ON ab.lesson_id = l.id
    WHERE tf.teacher_id = $1
      AND l.module_id IN (SELECT id FROM modules WHERE course_id = $2)
    ORDER BY tf.created_at DESC
  `, [teacherId, courseId]);
  
  return result.rows;
}

async function updateFeedback(feedbackId, feedback, scoreAdjustment, user) {
  assertSystemAdmin(user);
  await addFeedbackSchema();
  
  const result = await one(`
    UPDATE teacher_feedback
    SET feedback = $2, score_adjustment = $3
    WHERE id = $1
    RETURNING *
  `, [feedbackId, feedback, scoreAdjustment]);
  
  return result;
}

async function deleteFeedback(feedbackId, user) {
  assertSystemAdmin(user);
  await addFeedbackSchema();
  
  await one(`
    DELETE FROM teacher_feedback WHERE id = $1
  `, [feedbackId]);
  
  return { success: true };
}

module.exports = {
  addFeedback,
  getFeedbackForUser,
  getFeedbackByTeacher,
  updateFeedback,
  deleteFeedback
};
