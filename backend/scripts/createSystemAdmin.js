require("dotenv").config();

const bcrypt = require("bcryptjs");
const { assertRequiredEnv } = require("../config/env");
const { one, query, pool } = require("../config/database");

async function main() {
  assertRequiredEnv();

  const fullName = process.env.SYSTEM_ADMIN_FULL_NAME;
  const email = process.env.SYSTEM_ADMIN_EMAIL;
  const password = process.env.SYSTEM_ADMIN_PASSWORD;

  if (!fullName || !email || !password) {
    throw new Error("SYSTEM_ADMIN_FULL_NAME, SYSTEM_ADMIN_EMAIL, and SYSTEM_ADMIN_PASSWORD are required");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await one(
    "select id from users where role = 'system_admin' and lower(email) = $1 and deleted_at is null limit 1",
    [normalizedEmail]
  );

  if (existing) {
    await query(
      `update users
       set full_name = $2,
           name = $2,
           password_hash = $3,
           force_password_change = true,
           is_active = true,
           updated_at = now()
       where id = $1`,
      [existing.id, fullName, passwordHash]
    );
    console.log("System Admin account already existed and was updated from the provided environment values.");
    await pool.end();
    return;
  }

  await query(
    `insert into users (role, name, full_name, email, password_hash, must_change_password, force_password_change, two_factor_enabled, status, is_active)
     values ('system_admin', $1, $1, $2, $3, true, true, false, 'active', true)`,
    [fullName, normalizedEmail, passwordHash]
  );
  console.log("System Admin account created. Password change is required on first login.");
  await pool.end();
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
