const { query } = require("../config/database");

async function addFeedbackSchema() {
  console.log("Adding feedback schema...");

  try {
    const tableExists = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'teacher_feedback'
    `);

    if (tableExists.rows.length === 0) {
      await query(`
        CREATE TABLE teacher_feedback (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          activity_block_id UUID NOT NULL REFERENCES lesson_activity_blocks(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          feedback TEXT NOT NULL,
          score_adjustment INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log("✓ Created teacher_feedback table");

      await query(`
        CREATE INDEX idx_teacher_feedback_user_id ON teacher_feedback(user_id)
      `);
      await query(`
        CREATE INDEX idx_teacher_feedback_activity_block_id ON teacher_feedback(activity_block_id)
      `);
      await query(`
        CREATE INDEX idx_teacher_feedback_teacher_id ON teacher_feedback(teacher_id)
      `);
      console.log("✓ Created teacher_feedback indexes");

      await query(`
        CREATE OR REPLACE FUNCTION update_teacher_feedback_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);

      await query(`
        DROP TRIGGER IF EXISTS teacher_feedback_updated_at_trigger ON teacher_feedback
      `);

      await query(`
        CREATE TRIGGER teacher_feedback_updated_at_trigger
          BEFORE UPDATE ON teacher_feedback
          FOR EACH ROW
          EXECUTE FUNCTION update_teacher_feedback_updated_at()
      `);
      console.log("✓ Created teacher_feedback updated_at trigger");
    } else {
      console.log("✓ teacher_feedback table already exists");
    }

    console.log("\n✓ Feedback schema added successfully!");
  } catch (error) {
    console.error("✗ Error adding feedback schema:", error);
    throw error;
  }
}

if (require.main === module) {
  addFeedbackSchema()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { addFeedbackSchema };
