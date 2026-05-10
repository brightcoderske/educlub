const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { one, query } = require("../config/database");
const { env } = require("../config/env");
const { recordAudit } = require("../utils/audit");

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      school_id: user.school_id || null,
      email: user.email || null,
      username: user.username || null,
      full_name: user.full_name
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

async function login({ identifier, password }) {
  if (!identifier || !password) {
    const error = new Error("Identifier and password are required");
    error.statusCode = 400;
    throw error;
  }

  const normalized = identifier.trim().toLowerCase();
  const user = await one(
    `select u.id, u.school_id, u.role, coalesce(u.full_name, u.name) as full_name, u.email, u.username,
            u.password_hash, u.is_active, u.force_password_change, u.two_factor_enabled, u.last_login_at,
            s.is_active as school_active, s.status as school_status
     from users u
     left join schools s on s.id = u.school_id
     where u.deleted_at is null and (lower(u.email) = $1 or lower(u.username) = $1)
     limit 1`,
    [normalized]
  );
  if (user && user.role !== "system_admin" && user.school_id && !user.school_active) {
    const error = new Error("This school is inactive. Contact the System Admin to reactivate access.");
    error.statusCode = 403;
    throw error;
  }

  const valid = user && user.is_active && (await bcrypt.compare(password, user.password_hash));

  if (!valid) {
    const authError = new Error("Invalid credentials");
    authError.statusCode = 401;
    throw authError;
  }

  await query(
    "update users set previous_login_at = last_login_at, last_login_at = now(), updated_at = now() where id = $1",
    [user.id]
  );
  await recordAudit({
    actor: { id: user.id, role: user.role },
    action: "auth.login",
    targetType: "user",
    targetId: user.id,
    schoolId: user.school_id,
    metadata: { identifier: normalized }
  });

  return {
    accessToken: signAccessToken(user),
    user: {
      id: user.id,
      school_id: user.school_id,
      role: user.role,
      full_name: user.full_name,
      email: user.email,
      username: user.username,
      force_password_change: user.force_password_change,
      two_factor_enabled: user.two_factor_enabled,
      previous_login_at: user.last_login_at
    }
  };
}

module.exports = { login };
