const { query } = require("../config/database");

function safeUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

async function recordAudit({ client, actor, action, targetType = null, targetId = null, schoolId = null, termId = null, metadata = {} }) {
  const runner = client || { query };
  await runner.query(
    `insert into audit_logs (actor_user_id, actor_role, action, target_type, target_id, school_id, term_id, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      safeUuid(actor?.sub || actor?.id),
      actor?.role || null,
      action,
      targetType,
      safeUuid(targetId),
      safeUuid(schoolId),
      safeUuid(termId),
      metadata || {}
    ]
  );
}

module.exports = { recordAudit };
