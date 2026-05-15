const { Pool } = require("pg");
const { env } = require("./config/env");

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function addAboutColumn() {
  const client = await pool.connect();
  try {
    console.log("Starting column addition...");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS about TEXT");
    console.log("✓ about");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS learnings JSONB DEFAULT '[]'::jsonb");
    console.log("✓ learnings");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS thumbnail_type VARCHAR(20) DEFAULT 'image'");
    console.log("✓ thumbnail_type");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS meta_title VARCHAR(200)");
    console.log("✓ meta_title");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS meta_description TEXT");
    console.log("✓ meta_description");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS meta_keywords TEXT");
    console.log("✓ meta_keywords");
    
    await client.query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS public BOOLEAN DEFAULT false");
    console.log("✓ public");
    
    console.log("DONE");
  } catch (error) {
    console.error("ERROR:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addAboutColumn()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
