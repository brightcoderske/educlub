require("dotenv").config();

const { query, pool } = require("../config/database");

const tables = process.argv.slice(2);

async function main() {
  for (const table of tables) {
    const columns = await query(
      `select column_name, is_nullable, data_type, column_default
       from information_schema.columns
       where table_schema = $1 and table_name = $2
       order by ordinal_position`,
      ["public", table]
    );
    const constraints = await query(
      `select conname, pg_get_constraintdef(c.oid) as definition
       from pg_constraint c
       join pg_class t on t.oid = c.conrelid
       join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = $1 and t.relname = $2
       order by conname`,
      ["public", table]
    );
    console.log(`\n## ${table}`);
    console.log(JSON.stringify({ columns: columns.rows, constraints: constraints.rows }, null, 2));
  }
  await pool.end();
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  await pool.end();
  process.exit(1);
});
