require("dotenv").config();

const bcrypt = require("bcryptjs");
const { assertRequiredEnv } = require("../config/env");
const { one, query, pool } = require("../config/database");

async function main() {
  assertRequiredEnv();

  const fullName = process.env.SCHOOL_ADMIN_FULL_NAME;
  const email = process.env.SCHOOL_ADMIN_EMAIL;
  const password = process.env.SCHOOL_ADMIN_PASSWORD;
  const schoolId = process.env.SCHOOL_ADMIN_SCHOOL_ID;

  if (!fullName || !email || !password || !schoolId) {
    throw new Error("SCHOOL_ADMIN_FULL_NAME, SCHOOL_ADMIN_EMAIL, SCHOOL_ADMIN_PASSWORD, and SCHOOL_ADMIN_SCHOOL_ID are required");
  }

  const school = await one("select id from schools where id = $1 and deleted_at is null", [schoolId]);
  if (!school) {
    throw new Error("SCHOOL_ADMIN_SCHOOL_ID must point to an existing real school");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await one(
    "select id from users where role = 'school_admin' and lower(email) = $1 and deleted_at is null limit 1",
    [normalizedEmail]
  );

  if (existing) {
    await query(
      `update users
       set full_name = $2,
           name = $2,
           school_id = $3,
           password_hash = $4,
           force_password_change = true,
           two_factor_enabled = true,
           is_active = true,
           updated_at = now()
       where id = $1`,
      [existing.id, fullName, schoolId, passwordHash]
    );
    console.log("School Admin account already existed and was updated from the provided environment values.");
    await pool.end();
    return;
  }

  await query(
    `insert into users (school_id, role, name, full_name, email, password_hash, must_change_password, force_password_change, two_factor_enabled, status, is_active)
     values ($1, 'school_admin', $2, $2, $3, $4, true, true, true, 'active', true)`,
    [schoolId, fullName, normalizedEmail, passwordHash]
  );

  console.log("School Admin account created. Password change is required on first login.");
  await pool.end();
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  await pool.end();
  process.exit(1);
});
