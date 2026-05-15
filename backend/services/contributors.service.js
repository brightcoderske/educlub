const { query, one } = require("../config/database");
const { assertSystemAdmin } = require("./systemAdmin.service");
const { addCourseEnhancementsSchema } = require("../scripts/addCourseEnhancementsSchema");

async function ensure() {
  await addCourseEnhancementsSchema();
}

async function getContributorsByCourse(courseId, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await query(
    `SELECT cc.*, u.first_name, u.last_name, u.email 
     FROM course_contributors cc
     INNER JOIN users u ON cc.user_id = u.id
     WHERE cc.course_id = $1
     ORDER BY cc.created_at`,
    [courseId]
  );
  
  return result.rows;
}

async function addContributor(courseId, userId, role, canEdit, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await one(
    `INSERT INTO course_contributors (course_id, user_id, role, can_edit)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (course_id, user_id) 
     DO UPDATE SET role = $3, can_edit = $4
     RETURNING *`,
    [courseId, userId, role || 'contributor', canEdit !== false]
  );
  
  return result;
}

async function removeContributor(courseId, userId, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await one(
    `DELETE FROM course_contributors 
     WHERE course_id = $1 AND user_id = $2
     RETURNING *`,
    [courseId, userId]
  );
  
  if (!result) {
    const error = new Error("Contributor not found");
    error.statusCode = 404;
    throw error;
  }
  
  return result;
}

async function updateContributor(courseId, userId, role, canEdit, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await one(
    `UPDATE course_contributors 
     SET role = $3, can_edit = $4, updated_at = NOW()
     WHERE course_id = $1 AND user_id = $2
     RETURNING *`,
    [courseId, userId, role, canEdit]
  );
  
  if (!result) {
    const error = new Error("Contributor not found");
    error.statusCode = 404;
    throw error;
  }
  
  return result;
}

module.exports = {
  ensure,
  getContributorsByCourse,
  addContributor,
  removeContributor,
  updateContributor
};
