const { query } = require("../config/database");

async function addProgressSchema() {
  console.log("Adding progress tracking schema...");

  try {
    const tableExists = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'student_activity_submissions'
    `);

    if (tableExists.rows.length === 0) {
      await query(`
        CREATE TABLE student_activity_submissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          activity_block_id UUID NOT NULL REFERENCES lesson_activity_blocks(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          answer JSONB DEFAULT '{}'::jsonb,
          submission TEXT,
          score INTEGER DEFAULT 0,
          submitted_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(activity_block_id, user_id)
        )
      `);
      console.log("✓ Created student_activity_submissions table");

      await query(`
        CREATE INDEX idx_student_activity_submissions_user_id ON student_activity_submissions(user_id)
      `);
      await query(`
        CREATE INDEX idx_student_activity_submissions_activity_block_id ON student_activity_submissions(activity_block_id)
      `);
      console.log("✓ Created student_activity_submissions indexes");

      await query(`
        CREATE OR REPLACE FUNCTION update_student_activity_submissions_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);

      await query(`
        DROP TRIGGER IF EXISTS student_activity_submissions_updated_at_trigger ON student_activity_submissions
      `);

      await query(`
        CREATE TRIGGER student_activity_submissions_updated_at_trigger
          BEFORE UPDATE ON student_activity_submissions
          FOR EACH ROW
          EXECUTE FUNCTION update_student_activity_submissions_updated_at()
      `);
      console.log("✓ Created student_activity_submissions updated_at trigger");
    } else {
      console.log("✓ student_activity_submissions table already exists");
    }

    console.log("\n✓ Progress tracking schema added successfully!");
  } catch (error) {
    console.error("✗ Error adding progress tracking schema:", error);
    throw error;
  }
}

if (require.main === module) {
  addProgressSchema()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { addProgressSchema };
