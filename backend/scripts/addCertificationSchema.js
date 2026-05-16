const { query } = require("../config/database");

async function addCertificationSchema() {
  console.log("Adding certification schema...");

  try {
    await query("select pg_advisory_lock(hashtext('educlub_certification_schema'))");

    await query(`
      CREATE TABLE IF NOT EXISTS certifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        certification_uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        org_id INTEGER,
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_certifications_course_id ON certifications(course_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_certifications_org_id ON certifications(org_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_certifications_uuid ON certifications(certification_uuid)
    `);

    await query(`
      CREATE OR REPLACE FUNCTION update_certifications_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await query(`
      DROP TRIGGER IF EXISTS certifications_updated_at_trigger ON certifications
    `);

    await query(`
      CREATE TRIGGER certifications_updated_at_trigger
        BEFORE UPDATE ON certifications
        FOR EACH ROW
        EXECUTE FUNCTION update_certifications_updated_at()
    `);

    console.log("Certification schema is ready.");
  } catch (error) {
    console.error("Error adding certification schema:", error);
    throw error;
  } finally {
    await query("select pg_advisory_unlock(hashtext('educlub_certification_schema'))").catch(() => {});
  }
}

if (require.main === module) {
  addCertificationSchema()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { addCertificationSchema };
