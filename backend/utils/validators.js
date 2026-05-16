const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER_RE = /^[a-z0-9@._+-]{3,254}$/i;

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeString(value, field, { min = 1, max = 255, pattern } = {}) {
  if (typeof value !== "string") {
    throw badRequest(`${field} is required`);
  }

  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw badRequest(`${field} must be between ${min} and ${max} characters`);
  }

  if (pattern && !pattern.test(normalized)) {
    throw badRequest(`${field} contains invalid characters`);
  }

  return normalized;
}

function validateLoginInput(input = {}) {
  return {
    identifier: normalizeString(input.identifier, "Identifier", {
      min: 3,
      max: 254,
      pattern: IDENTIFIER_RE
    }).toLowerCase(),
    password: normalizeString(input.password, "Password", { min: 1, max: 512 })
  };
}

function validateTwoFactorInput(input = {}) {
  const challengeId = normalizeString(input.challengeId, "Challenge id", {
    min: 36,
    max: 36,
    pattern: UUID_RE
  });
  const code = normalizeString(input.code, "Verification code", {
    min: 6,
    max: 6,
    pattern: /^\d{6}$/
  });

  return { challengeId, code };
}

module.exports = {
  validateLoginInput,
  validateTwoFactorInput
};
