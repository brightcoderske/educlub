const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { one, query } = require("../config/database");
const { env } = require("../config/env");

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
    `select id, school_id, role, coalesce(full_name, name) as full_name, email, username, password_hash, is_active, force_password_change, two_factor_enabled, last_login_at
     from users
     where deleted_at is null and (lower(email) = $1 or lower(username) = $1)
     limit 1`,
    [normalized]
  );
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
