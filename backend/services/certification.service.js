const { query, one, transaction } = require("../config/database");
const { assertSystemAdmin } = require("./systemAdmin.service");
const { addCertificationSchema } = require("../scripts/addCertificationSchema");

async function ensure() {
  await addCertificationSchema();
}

async function getCertificationsByCourse(courseId, user) {
  if (!user || !["system_admin", "school_admin"].includes(user.role)) {
    const error = new Error("Certification access required");
    error.statusCode = 403;
    throw error;
  }
  await ensure();
  
  const result = await query(
    `SELECT * FROM certifications WHERE course_id = $1 ORDER BY created_at DESC`,
    [courseId]
  );
  return result.rows;
}

async function getCertificationByUUID(certificationUuid, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await one(
    `SELECT * FROM certifications WHERE certification_uuid = $1`,
    [certificationUuid]
  );
  return result;
}

async function createCertification(courseId, config, orgId, user) {
  assertSystemAdmin(user);
  await ensure();
  
  // Verify course exists
  const course = await one(
    `SELECT id FROM courses WHERE id = $1 AND deleted_at IS NULL`,
    [courseId]
  );
  
  if (!course) {
    const error = new Error("Course not found");
    error.statusCode = 404;
    throw error;
  }
  
  const result = await one(
    `INSERT INTO certifications (course_id, org_id, config)
     VALUES ($1, $2, $3::jsonb)
     RETURNING *`,
    [courseId, orgId, JSON.stringify(config)]
  );
  
  return result;
}

async function updateCertification(certificationUuid, config, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await one(
    `UPDATE certifications 
     SET config = $2::jsonb, updated_at = NOW()
     WHERE certification_uuid = $1
     RETURNING *`,
    [certificationUuid, JSON.stringify(config)]
  );
  
  if (!result) {
    const error = new Error("Certification not found");
    error.statusCode = 404;
    throw error;
  }
  
  return result;
}

async function deleteCertification(certificationUuid, user) {
  assertSystemAdmin(user);
  await ensure();
  
  const result = await one(
    `DELETE FROM certifications 
     WHERE certification_uuid = $1
     RETURNING *`,
    [certificationUuid]
  );
  
  if (!result) {
    const error = new Error("Certification not found");
    error.statusCode = 404;
    throw error;
  }
  
  return result;
}

module.exports = {
  ensure,
  getCertificationsByCourse,
  getCertificationByUUID,
  createCertification,
  updateCertification,
  deleteCertification
};
