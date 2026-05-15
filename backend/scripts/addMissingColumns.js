const { query } = require("../config/database");

async function addMissingColumns() {
  console.log("Adding missing columns to courses table...");
  
  try {
    const columnsToAdd = [
      { name: 'about', type: 'TEXT' },
      { name: 'learnings', type: 'JSONB DEFAULT \'[]\'::jsonb' },
      { name: 'thumbnail_type', type: 'VARCHAR(20) DEFAULT \'image\'' },
      { name: 'meta_title', type: 'VARCHAR(200)' },
      { name: 'meta_description', type: 'TEXT' },
      { name: 'meta_keywords', type: 'TEXT' },
      { name: 'public', type: 'BOOLEAN DEFAULT false' }
    ];
    
    for (const col of columnsToAdd) {
      try {
        const exists = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'courses' AND column_name = '${col.name}'
        `);
        
        if (exists.rows.length === 0) {
          await query(`ALTER TABLE courses ADD COLUMN ${col.name} ${col.type}`);
          console.log(`✓ Added ${col.name} column`);
        } else {
          console.log(`✓ ${col.name} column already exists`);
        }
      } catch (err) {
        console.log(`Note for ${col.name}: ${err.message}`);
      }
    }
    
    console.log("\n✓ Done!");
  } catch (error) {
    console.error("✗ Error:", error.message);
    throw error;
  }
}

addMissingColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
