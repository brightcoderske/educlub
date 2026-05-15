const { Pool } = require("pg");
const { env } = require("./config/env");

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function fixColumns() {
  const client = await pool.connect();
  try {
    console.log("Adding missing columns to courses table...");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS about TEXT");
    console.log("✓ about column");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS learnings JSONB DEFAULT '[]'::jsonb");
    console.log("✓ learnings column");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_type VARCHAR(20) DEFAULT 'image'");
    console.log("✓ thumbnail_type column");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS meta_title VARCHAR(200)");
    console.log("✓ meta_title column");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS meta_description TEXT");
    console.log("✓ meta_description column");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS meta_keywords TEXT");
    console.log("✓ meta_keywords column");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS public BOOLEAN DEFAULT false");
    console.log("✓ public column");
    
    console.log("\n✓ All columns added successfully!");
  } catch (error) {
    console.error("✗ Error:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
