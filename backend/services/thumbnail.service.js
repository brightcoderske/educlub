const { query, one } = require("../config/database");
const { assertSystemAdmin } = require("./systemAdmin.service");
const { addCourseEnhancementsSchema } = require("../scripts/addCourseEnhancementsSchema");

async function ensure() {
  await addCourseEnhancementsSchema();
}

async function updateCourseThumbnail(courseId, thumbnailUrl, thumbnailType, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await one(
    `UPDATE courses 
     SET cover_image_url = $2, thumbnail_type = $3, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, cover_image_url, thumbnail_type`,
    [courseId, thumbnailUrl, thumbnailType]
  );
  
  if (!result) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }
  
  return result;
}

module.exports = {
  ensure,
  updateCourseThumbnail
};
