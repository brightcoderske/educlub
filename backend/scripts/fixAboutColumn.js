const { query } = require("../config/database");

async function fixAboutColumn() {
  console.log("Checking and fixing about column...");
  
  try {
    const columnExists = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses' AND column_name = 'about'
    `);
    
    console.log("Column check result:", columnExists.rows.length);
    
    if (columnExists.rows.length === 0) {
      console.log("Adding about column...");
      await query(`ALTER TABLE courses ADD COLUMN about TEXT`);
      console.log("✓ Added about column");
    } else {
      console.log("✓ About column already exists");
    }
    
    console.log("\n✓ Done!");
  } catch (error) {
    console.error("✗ Error:", error.message);
    throw error;
  }
}

fixAboutColumn()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
