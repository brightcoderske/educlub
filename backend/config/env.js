require("dotenv").config();

const required = ["DATABASE_URL", "JWT_SECRET"];

function getEnv(name, fallback = undefined) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
}

function getListEnv(name, fallback = "") {
  return getEnv(name, fallback)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function assertRequiredEnv() {
  const missing = required.filter((name) => !getEnv(name));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

module.exports = {
  assertRequiredEnv,
  env: {
    nodeEnv: getEnv("NODE_ENV", "development"),
    port: Number(getEnv("PORT", 4000)),
    frontendOrigins: getListEnv("FRONTEND_ORIGIN", "http://localhost:3000,http://127.0.0.1:3000"),
    databaseUrl: getEnv("DATABASE_URL"),
    jwtSecret: getEnv("JWT_SECRET"),
    jwtExpiresIn: getEnv("JWT_EXPIRES_IN", "1h"),
    refreshTokenExpiresIn: getEnv("REFRESH_TOKEN_EXPIRES_IN", "7d")
  }
};
