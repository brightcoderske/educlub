const { query, one } = require("../config/database");

async function generateCertificateForUser(courseId, userId, user) {
  // Check if user is the student themselves or a school admin
  const isSchoolAdmin = user.role === "school_admin" || user.role === "system_admin";
  const isOwnCertificate = user.id === userId;
  
  if (!isSchoolAdmin && !isOwnCertificate) {
    const error = new Error("Unauthorized to generate this certificate");
    error.statusCode = 403;
    throw error;
  }
  
  const course = await one(`
    SELECT c.name, c.description
    FROM courses c
    WHERE c.id = $1 AND c.deleted_at IS NULL
  `, [courseId]);
  
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }
  
  const certification = await one(`
    SELECT config, certification_uuid
    FROM certifications
    WHERE course_id = $1 AND config->>'enabled' = 'true'
  `, [courseId]);
  
  if (!certification) {
    const error = new Error("No certification enabled for this course");
    error.statusCode = 404;
    throw error;
  }
  
  const student = await one(`
    SELECT first_name, last_name, email
    FROM users
    WHERE id = $1
  `, [userId]);
  
  if (!student) {
    const error = new Error("Student not found");
    error.statusCode = 404;
    throw error;
  }
  
  const progress = await query(`
    SELECT COUNT(DISTINCT sa.activity_block_id) as completed_activities
    FROM student_activity_submissions sa
    INNER JOIN lesson_activity_blocks ab ON sa.activity_block_id = ab.id
    INNER JOIN lessons l ON ab.lesson_id = l.id
    WHERE l.module_id IN (SELECT id FROM modules WHERE course_id = $1) AND sa.user_id = $2
  `, [courseId, userId]);
  
  const totalActivities = await one(`
    SELECT COUNT(*) as total
    FROM lesson_activity_blocks ab
    INNER JOIN lessons l ON ab.lesson_id = l.id
    WHERE l.module_id IN (SELECT id FROM modules WHERE course_id = $1)
  `, [courseId]);
  
  const completionPercentage = totalActivities.total > 0 
    ? Math.round((progress.rows[0].completed_activities / totalActivities.total) * 100)
    : 0;
  
  if (completionPercentage < 80) {
    const error = new Error("Course completion must be at least 80% to receive certificate");
    error.statusCode = 400;
    throw error;
  }
  
  const certificateData = {
    student_name: `${student.first_name} ${student.last_name}`,
    student_email: student.email,
    course_name: course.name,
    course_description: course.description,
    completion_date: new Date().toISOString(),
    certification_uuid: certification.certification_uuid,
    pattern: certification.config.pattern || "modern",
    instructor_name: certification.config.instructor_name || certification.config.instructorName || "Instructor",
    config: certification.config
  };
  
  return certificateData;
}

async function getCertificateTemplate(pattern) {
  const templates = {
    royal: {
      background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
      accent: "#e94560",
      textColor: "#ffffff"
    },
    tech: {
      background: "linear-gradient(135deg, #0d1b2a, #1b263b, #415a77)",
      accent: "#00d4ff",
      textColor: "#ffffff"
    },
    nature: {
      background: "linear-gradient(135deg, #1a3a2a, #2d5a3d, #4a7c59)",
      accent: "#7fb069",
      textColor: "#ffffff"
    },
    geometric: {
      background: "linear-gradient(45deg, #667eea, #764ba2, #f093fb)",
      accent: "#ffffff",
      textColor: "#ffffff"
    },
    vintage: {
      background: "linear-gradient(135deg, #8b4513, #a0522d, #cd853f)",
      accent: "#ffd700",
      textColor: "#ffffff"
    },
    waves: {
      background: "linear-gradient(135deg, #006994, #008bb8, #00a7e6)",
      accent: "#ffffff",
      textColor: "#ffffff"
    },
    minimal: {
      background: "#ffffff",
      accent: "#000000",
      textColor: "#000000"
    },
    professional: {
      background: "linear-gradient(135deg, #2c3e50, #34495e, #5d6d7e)",
      accent: "#3498db",
      textColor: "#ffffff"
    },
    academic: {
      background: "linear-gradient(135deg, #1e3a5f, #2e5a8f, #3e7abf)",
      accent: "#ffd700",
      textColor: "#ffffff"
    },
    modern: {
      background: "linear-gradient(135deg, #667eea, #764ba2)",
      accent: "#ffffff",
      textColor: "#ffffff"
    }
  };
  
  return templates[pattern] || templates.modern;
}

module.exports = {
  generateCertificateForUser,
  getCertificateTemplate
};
