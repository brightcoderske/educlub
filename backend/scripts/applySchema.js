require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { assertRequiredEnv } = require("../config/env");
const { query, pool } = require("../config/database");

async function main() {
  assertRequiredEnv();
  const schemaPath = path.resolve(__dirname, "..", "..", "database", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  await query(schemaSql);
  console.log("Database schema and RLS security rules applied.");
  await pool.end();
}

main().catch(async (error) => {
  console.error(error.message);
  await pool.end();
  process.exit(1);
});
