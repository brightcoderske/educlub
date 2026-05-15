const { query } = require("../config/database");

async function checkAndAddColumns() {
  console.log("Checking courses table columns...");
  
  try {
    const existingColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses'
      ORDER BY ordinal_position
    `);
    
    console.log("Existing columns:", existingColumns.rows.map(r => r.column_name));
    
    const requiredColumns = [
      { name: 'about', type: 'TEXT' },
      { name: 'learnings', type: 'JSONB DEFAULT \'[]\'::jsonb' },
      { name: 'thumbnail_type', type: 'VARCHAR(20) DEFAULT \'image\'' },
      { name: 'meta_title', type: 'VARCHAR(200)' },
      { name: 'meta_description', type: 'TEXT' },
      { name: 'meta_keywords', type: 'TEXT' },
      { name: 'public', type: 'BOOLEAN DEFAULT false' }
    ];
    
    for (const col of requiredColumns) {
      const exists = existingColumns.rows.find(r => r.column_name === col.name);
      if (!exists) {
        console.log(`Adding ${col.name} column...`);
        await query(`ALTER TABLE courses ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✓ Added ${col.name}`);
      } else {
        console.log(`✓ ${col.name} already exists`);
      }
    }
    
    console.log("\n✓ All required columns are now present!");
  } catch (error) {
    console.error("✗ Error:", error.message);
    throw error;
  }
}

checkAndAddColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
