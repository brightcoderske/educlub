const { query } = require("../config/database");

async function addCourseEnhancementsSchema() {
  console.log("Adding course enhancements schema...");

  try {
    // Add about field
    const aboutColumnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'about'
    `);

    if (aboutColumnExists.rows.length === 0) {
      await query(`ALTER TABLE courses ADD COLUMN about TEXT`);
      console.log("✓ Added about field to courses table");
    } else {
      console.log("✓ About field already exists in courses table");
    }

    // Add learnings field (JSON with emoji support)
    const learningsColumnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'learnings'
    `);

    if (learningsColumnExists.rows.length === 0) {
      await query(`ALTER TABLE courses ADD COLUMN learnings JSONB DEFAULT '[]'::jsonb`);
      console.log("✓ Added learnings field to courses table");
    } else {
      console.log("✓ Learnings field already exists in courses table");
    }

    // Add thumbnail_type field
    const thumbnailTypeColumnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'thumbnail_type'
    `);

    if (thumbnailTypeColumnExists.rows.length === 0) {
      await query(`ALTER TABLE courses ADD COLUMN thumbnail_type VARCHAR(20) DEFAULT 'image'`);
      console.log("✓ Added thumbnail_type field to courses table");
    } else {
      console.log("✓ Thumbnail_type field already exists in courses table");
    }

    // Add SEO fields
    const metaTitleColumnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'meta_title'
    `);

    if (metaTitleColumnExists.rows.length === 0) {
      await query(`ALTER TABLE courses ADD COLUMN meta_title VARCHAR(200)`);
      console.log("✓ Added meta_title field to courses table");
    } else {
      console.log("✓ Meta_title field already exists in courses table");
    }

    const metaDescColumnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'meta_description'
    `);

    if (metaDescColumnExists.rows.length === 0) {
      await query(`ALTER TABLE courses ADD COLUMN meta_description TEXT`);
      console.log("✓ Added meta_description field to courses table");
    } else {
      console.log("✓ Meta_description field already exists in courses table");
    }

    const metaKeywordsColumnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'meta_keywords'
    `);

    if (metaKeywordsColumnExists.rows.length === 0) {
      await query(`ALTER TABLE courses ADD COLUMN meta_keywords TEXT`);
      console.log("✓ Added meta_keywords field to courses table");
    } else {
      console.log("✓ Meta_keywords field already exists in courses table");
    }

    // Create tags table
    await query(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✓ Created tags table");

    // Create course_tags junction table
    await query(`
      CREATE TABLE IF NOT EXISTS course_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(course_id, tag_id)
      )
    `);
    console.log("✓ Created course_tags junction table");

    // Add indexes for tags
    await query(`
      CREATE INDEX IF NOT EXISTS idx_course_tags_course_id ON course_tags(course_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_course_tags_tag_id ON course_tags(tag_id)
    `);
    console.log("✓ Created course_tags indexes");

    // Create course_contributors table
    await query(`
      CREATE TABLE IF NOT EXISTS course_contributors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'contributor',
        can_edit BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(course_id, user_id)
      )
    `);
    console.log("✓ Created course_contributors table");

    // Add indexes for contributors
    await query(`
      CREATE INDEX IF NOT EXISTS idx_course_contributors_course_id ON course_contributors(course_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_course_contributors_user_id ON course_contributors(user_id)
    `);
    console.log("✓ Created course_contributors indexes");

    console.log("\n✓ Course enhancements schema added successfully!");
  } catch (error) {
    console.error("✗ Error adding course enhancements schema:", error);
    throw error;
  }
}

if (require.main === module) {
  addCourseEnhancementsSchema()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { addCourseEnhancementsSchema };
