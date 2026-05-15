const { query } = require("../config/database");

async function directAddColumns() {
  console.log("Adding missing columns to courses table...");
  
  try {
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS about TEXT`);
    console.log("✓ Checked about column");
    
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS learnings JSONB DEFAULT '[]'::jsonb`);
    console.log("✓ Checked learnings column");
    
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_type VARCHAR(20) DEFAULT 'image'`);
    console.log("✓ Checked thumbnail_type column");
    
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS meta_title VARCHAR(200)`);
    console.log("✓ Checked meta_title column");
    
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS meta_description TEXT`);
    console.log("✓ Checked meta_description column");
    
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS meta_keywords TEXT`);
    console.log("✓ Checked meta_keywords column");
    
    await query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS public BOOLEAN DEFAULT false`);
    console.log("✓ Checked public column");
    
    console.log("\n✓ All columns checked/added successfully!");
  } catch (error) {
    console.error("✗ Error:", error.message);
    throw error;
  }
}

directAddColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
