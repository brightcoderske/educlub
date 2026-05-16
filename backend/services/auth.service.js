const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { one, query } = require("../config/database");
const { sendTwoFactorCode } = require("../config/email");
const { env } = require("../config/env");
const { recordAudit } = require("../utils/audit");
const { ensureTwoFactorSchema } = require("../utils/schemaGuard");
const { validateLoginInput, validateTwoFactorInput } = require("../utils/validators");

const TWO_FACTOR_ROLES = new Set(["system_admin", "school_admin"]);

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

async function login(input) {
  const { identifier: normalized, password } = validateLoginInput(input);
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

  if (TWO_FACTOR_ROLES.has(user.role)) {
    await ensureTwoFactorSchema({ query });

    if (!user.email) {
      const error = new Error("This account has no email address for 2FA.");
      error.statusCode = 400;
      throw error;
    }

    const challenge = await createTwoFactorChallenge(user);
    await sendTwoFactorCode({
      to: user.email,
      name: user.full_name,
      code: challenge.code
    });

    await recordAudit({
      actor: { id: user.id, role: user.role },
      action: "auth.2fa_requested",
      targetType: "user",
      targetId: user.id,
      schoolId: user.school_id,
      metadata: { identifier: normalized }
    });

    return {
      requiresTwoFactor: true,
      challengeId: challenge.challengeId,
      delivery: "email",
      email: maskEmail(user.email)
    };
  }

  return completeLogin(user, normalized);
}

async function verifyTwoFactor(input) {
  await ensureTwoFactorSchema({ query });

  const { challengeId, code } = validateTwoFactorInput(input);
  const challenge = await one(
    `select c.id as challenge_id, c.user_id, c.code_hash, c.attempts, c.expires_at, c.consumed_at,
            u.id, u.school_id, u.role, coalesce(u.full_name, u.name) as full_name,
            u.email, u.username, u.force_password_change, u.two_factor_enabled,
            u.last_login_at, u.is_active, s.is_active as school_active
     from login_2fa_challenges c
     join users u on u.id = c.user_id
     left join schools s on s.id = u.school_id
     where c.id = $1 and u.deleted_at is null
     limit 1`,
    [challengeId]
  );

  if (!challenge || challenge.consumed_at || new Date(challenge.expires_at) <= new Date()) {
    const error = new Error("Verification code has expired. Please sign in again.");
    error.statusCode = 401;
    throw error;
  }

  if (!challenge.is_active || (challenge.role !== "system_admin" && challenge.school_id && !challenge.school_active)) {
    const error = new Error("This account is not active.");
    error.statusCode = 403;
    throw error;
  }

  if (challenge.attempts >= 5) {
    const error = new Error("Too many verification attempts. Please sign in again.");
    error.statusCode = 429;
    throw error;
  }

  const valid = safeCompare(hashTwoFactorCode(code), challenge.code_hash);
  if (!valid) {
    await query("update login_2fa_challenges set attempts = attempts + 1 where id = $1", [challengeId]);
    const error = new Error("Invalid verification code");
    error.statusCode = 401;
    throw error;
  }

  await query("update login_2fa_challenges set consumed_at = now(), updated_at = now() where id = $1", [challengeId]);
  return completeLogin(challenge, challenge.email);
}

async function completeLogin(user, identifier) {
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
    metadata: { identifier }
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

async function createTwoFactorChallenge(user) {
  const code = String(crypto.randomInt(100000, 1000000));
  await query(
    "update login_2fa_challenges set consumed_at = now(), updated_at = now() where user_id = $1 and consumed_at is null",
    [user.id]
  );
  const result = await one(
    `insert into login_2fa_challenges (user_id, code_hash, expires_at)
     values ($1, $2, now() + ($3::text || ' minutes')::interval)
     returning id`,
    [user.id, hashTwoFactorCode(code), env.twoFactorCodeMinutes]
  );

  return { challengeId: result.id, code };
}

function hashTwoFactorCode(code) {
  return crypto
    .createHmac("sha256", env.jwtSecret)
    .update(code)
    .digest("hex");
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right || "");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function maskEmail(email) {
  const [name, domain] = String(email).split("@");
  if (!name || !domain) return "configured email";
  const visible = name.length <= 2 ? `${name[0] || ""}*` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${visible}@${domain}`;
}

module.exports = { login, verifyTwoFactor };
