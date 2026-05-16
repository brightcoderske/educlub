require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { assertRequiredEnv } = require("../config/env");
const { query, pool } = require("../config/database");

async function main() {
  assertRequiredEnv();
  const cleanupPath = path.resolve(__dirname, "..", "..", "database", "cleanup_legacy.sql");
  const cleanupSql = fs.readFileSync(cleanupPath, "utf8");
  await query(cleanupSql);
  console.log("Legacy database cleanup applied.");
  await pool.end();
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  await pool.end();
  process.exit(1);
});
