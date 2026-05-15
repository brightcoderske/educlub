const { query, one } = require("../config/database");
const { assertSystemAdmin } = require("./systemAdmin.service");
const { addAccessControlSchema } = require("../scripts/addAccessControlSchema");

async function ensure() {
  await addAccessControlSchema();
}

async function toggleCourseAccess(courseId, isPublic, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await one(
    `UPDATE courses 
     SET public = $2, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, public`,
    [courseId, isPublic]
  );
  
  if (!result) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }
  
  return result;
}

async function linkCourseToUserGroup(courseId, userGroupId, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await one(
    `INSERT INTO user_groups_courses (user_group_id, course_id)
     VALUES ($1, $2)
     ON CONFLICT (user_group_id, course_id) DO NOTHING
     RETURNING *`,
    [userGroupId, courseId]
  );
  
  return result;
}

async function unlinkCourseFromUserGroup(courseId, userGroupId, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await one(
    `DELETE FROM user_groups_courses 
     WHERE user_group_id = $1 AND course_id = $2
     RETURNING *`,
    [userGroupId, courseId]
  );
  
  if (!result) {
    const error = new Error("Link not found");
    error.statusCode = 404;
    throw error;
  }
  
  return result;
}

async function getUserGroupsForCourse(courseId, orgId, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await query(
    `SELECT ug.* FROM user_groups ug
     INNER JOIN user_groups_courses ugc ON ug.id = ugc.user_group_id
     WHERE ugc.course_id = $1 AND ug.org_id = $2
     ORDER BY ug.name`,
    [courseId, orgId]
  );
  
  return result.rows;
}

module.exports = {
  ensure,
  toggleCourseAccess,
  linkCourseToUserGroup,
  unlinkCourseFromUserGroup,
  getUserGroupsForCourse
};
