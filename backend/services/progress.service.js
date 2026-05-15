const { query, one, transaction } = require("../config/database");
const { assertSystemAdmin } = require("./systemAdmin.service");

async function getStudentProgress(courseId, userId, user) {
  assertSystemAdmin(user);
  
  const result = await query(`
    SELECT 
      l.id as lesson_id,
      l.name as lesson_name,
      l.module_id,
      COALESCE(ab.activity_type, 'none') as activity_type,
      COALESCE(ab.marks_weight, 0) as marks_weight,
      CASE 
        WHEN sa.id IS NOT NULL THEN true
        ELSE false
      END as completed,
      COALESCE(sa.score, 0) as score,
      sa.submitted_at
    FROM lessons l
    LEFT JOIN lesson_activity_blocks ab ON l.id = ab.lesson_id
    LEFT JOIN student_activity_submissions sa ON ab.id = sa.activity_block_id AND sa.user_id = $2
    WHERE l.module_id IN (SELECT id FROM modules WHERE course_id = $1)
    ORDER BY l.module_id, l.sort_order, ab.sort_order
  `, [courseId, userId]);
  
  const completedLessons = await query(`
    SELECT DISTINCT l.id
    FROM lessons l
    INNER JOIN lesson_activity_blocks ab ON l.id = ab.lesson_id
    INNER JOIN student_activity_submissions sa ON ab.id = sa.activity_block_id AND sa.user_id = $2
    WHERE l.module_id IN (SELECT id FROM modules WHERE course_id = $1)
  `, [courseId, userId]);
  
  const totalScore = await one(`
    SELECT COALESCE(SUM(sa.score), 0) as total_score
    FROM student_activity_submissions sa
    INNER JOIN lesson_activity_blocks ab ON sa.activity_block_id = ab.id
    INNER JOIN lessons l ON ab.lesson_id = l.id
    WHERE l.module_id IN (SELECT id FROM modules WHERE course_id = $1) AND sa.user_id = $2
  `, [courseId, userId]);
  
  return {
    activities: result.rows,
    completed_lessons: completedLessons.rows.map(r => r.id),
    completed_activities: result.rows.filter(r => r.completed).map(r => r.activity_id),
    total_score: totalScore.total_score || 0
  };
}

async function submitActivity(activityBlockId, userId, answer, submission, user) {
  assertSystemAdmin(user);
  
  const activity = await one(`
    SELECT ab.marks_weight, ab.activity_type, ab.payload
    FROM lesson_activity_blocks ab
    WHERE ab.id = $1
  `, [activityBlockId]);
  
  if (!activity) {
    const error = new Error("Activity not found");
    error.statusCode = 404;
    throw error;
  }
  
  let score = 0;
  
  if (activity.activity_type === 'quiz') {
    const correctAnswer = activity.payload?.quiz?.correct_answer;
    if (answer?.answer === correctAnswer) {
      score = activity.marks_weight || 10;
    }
  } else if (activity.activity_type === 'learn_content') {
    score = activity.marks_weight || 10;
  } else if (activity.activity_type === 'practice') {
    score = Math.floor((activity.marks_weight || 10) * 0.5);
  }
  
  const result = await one(`
    INSERT INTO student_activity_submissions (activity_block_id, user_id, answer, submission, score, submitted_at)
    VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
    ON CONFLICT (activity_block_id, user_id) 
    DO UPDATE SET 
      answer = $3::jsonb,
      submission = $4,
      score = $5,
      submitted_at = NOW()
    RETURNING *
  `, [activityBlockId, userId, JSON.stringify(answer || {}), submission || null, score]);
  
  return result;
}

async function getCourseLeaderboard(courseId, user) {
  assertSystemAdmin(user);
  
  const result = await query(`
    SELECT 
      u.id as user_id,
      u.first_name,
      u.last_name,
      COALESCE(SUM(sa.score), 0) as total_score,
      COUNT(DISTINCT sa.activity_block_id) as activities_completed
    FROM users u
    INNER JOIN student_activity_submissions sa ON u.id = sa.user_id
    INNER JOIN lesson_activity_blocks ab ON sa.activity_block_id = ab.id
    INNER JOIN lessons l ON ab.lesson_id = l.id
    WHERE l.module_id IN (SELECT id FROM modules WHERE course_id = $1)
    GROUP BY u.id, u.first_name, u.last_name
    ORDER BY total_score DESC
    LIMIT 50
  `, [courseId]);
  
  return result.rows;
}

async function getStudentXp(userId, user) {
  assertSystemAdmin(user);
  
  const result = await one(`
    SELECT COALESCE(SUM(score), 0) as total_xp
    FROM student_activity_submissions
    WHERE user_id = $1
  `, [userId]);
  
  return { total_xp: result.total_xp || 0 };
}

module.exports = {
  getStudentProgress,
  submitActivity,
  getCourseLeaderboard,
  getStudentXp
};
