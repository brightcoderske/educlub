require("dotenv").config();

const { query, pool } = require("../config/database");

async function main() {
  const columns = await query(
    `select column_name, is_nullable, column_default, data_type
     from information_schema.columns
     where table_schema = 'public' and table_name = 'users'
     order by ordinal_position`
  );
  const constraints = await query(
    `select conname, pg_get_constraintdef(c.oid) as definition
     from pg_constraint c
     join pg_class t on t.oid = c.conrelid
     join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = 'users'
     order by conname`
  );

  console.log(JSON.stringify({ columns: columns.rows, constraints: constraints.rows }, null, 2));
  await pool.end();
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  await pool.end();
  process.exit(1);
});
