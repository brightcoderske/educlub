const { query } = require("../config/database");

async function addAccessControlSchema() {
  console.log("Adding access control schema...");

  try {
    // Add public field to courses table if it doesn't exist
    const publicColumnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'public'
    `);

    if (publicColumnExists.rows.length === 0) {
      await query(`ALTER TABLE courses ADD COLUMN public BOOLEAN DEFAULT true`);
      console.log("✓ Added public field to courses table");
    } else {
      console.log("✓ Public field already exists in courses table");
    }

    // Create user_groups_courses junction table
    await query(`
      CREATE TABLE IF NOT EXISTS user_groups_courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_group_id INTEGER NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_group_id, course_id)
      )
    `);
    console.log("✓ Created user_groups_courses junction table");

    // Add indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_user_groups_courses_user_group_id ON user_groups_courses(user_group_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_user_groups_courses_course_id ON user_groups_courses(course_id)
    `);
    console.log("✓ Created user_groups_courses indexes");

    console.log("\n✓ Access control schema added successfully!");
  } catch (error) {
    console.error("✗ Error adding access control schema:", error);
    throw error;
  }
}

if (require.main === module) {
  addAccessControlSchema()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { addAccessControlSchema };
