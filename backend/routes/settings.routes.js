const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");
const { list, pagination } = require("../config/database");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/school-preferences", async (req, res, next) => {
  try {
    const { limit, offset } = pagination(req.query);
    const values = [];
    const where = ["true"];
    if (req.query.school_id) {
      values.push(req.query.school_id);
      where.push(`sp.school_id = $${values.length}`);
    }
    values.push(limit, offset);
    res.json(await list(
      `select sp.id, sp.school_id, sp.typing_passage_words, sp.typing_timer_seconds, sp.module_pass_threshold,
              sp.leaderboards_visible, sp.ai_enabled, s.name as school_name
       from school_preferences sp join schools s on s.id = sp.school_id
       where ${where.join(" and ")}
       order by sp.created_at desc limit $${values.length - 1} offset $${values.length}`,
      values,
      `select count(*) from school_preferences sp where ${where.join(" and ")}`,
      values.slice(0, -2)
    ));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
