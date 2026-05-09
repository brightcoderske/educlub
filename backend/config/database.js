const { Pool } = require("pg");
const { env } = require("./env");

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: { rejectUnauthorized: false }
});

function pagination({ page = 1, pageSize = 25 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeSize = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
  return {
    limit: safeSize,
    offset: (safePage - 1) * safeSize
  };
}

async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result;
}

async function one(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

async function list(text, params = [], countText = null, countParams = params) {
  const [rows, count] = await Promise.all([
    query(text, params),
    countText ? query(countText, countParams) : Promise.resolve({ rows: [{ count: null }] })
  ]);

  return {
    data: rows.rows,
    count: count.rows[0].count === null ? null : Number(count.rows[0].count)
  };
}

async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  one,
  list,
  pagination,
  transaction
};
