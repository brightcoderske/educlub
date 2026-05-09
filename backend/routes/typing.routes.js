const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");
const { list, pagination } = require("../config/database");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/results", async (req, res, next) => {
  try {
    const { limit, offset } = pagination(req.query);
    const values = [];
    const where = ["true"];
    if (req.query.school_id) {
      values.push(req.query.school_id);
      where.push(`tr.school_id = $${values.length}`);
    }
    if (req.query.term_id) {
      values.push(req.query.term_id);
      where.push(`tr.term_id = $${values.length}`);
    }
    values.push(limit, offset);
    res.json(await list(
      `select tr.id, tr.learner_id, tr.school_id, tr.term_id, tr.wpm, tr.accuracy, tr.time_taken_seconds, tr.created_at,
              u.full_name, u.grade, u.stream, s.name as school_name, t.name as term_name
       from typing_results tr
       join users u on u.id = tr.learner_id
       join schools s on s.id = tr.school_id
       join terms t on t.id = tr.term_id
       where ${where.join(" and ")}
       order by tr.created_at desc limit $${values.length - 1} offset $${values.length}`,
      values,
      `select count(*) from typing_results tr where ${where.join(" and ")}`,
      values.slice(0, -2)
    ));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
