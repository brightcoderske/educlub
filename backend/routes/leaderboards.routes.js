const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { requireRoles } = require("../middleware/role.middleware");
const { list, pagination } = require("../config/database");

const router = express.Router();
router.use(authenticate, requireRoles("system_admin"));

router.get("/", async (req, res, next) => {
  try {
    const { limit, offset } = pagination(req.query);
    const values = [];
    const where = ["true"];
    if (req.query.school_id) {
      values.push(req.query.school_id);
      where.push(`le.school_id = $${values.length}`);
    }
    if (req.query.term_id) {
      values.push(req.query.term_id);
      where.push(`le.term_id = $${values.length}`);
    }
    if (req.query.leaderboard_type) {
      values.push(req.query.leaderboard_type);
      where.push(`le.leaderboard_type = $${values.length}`);
    }
    values.push(limit, offset);
    res.json(await list(
      `select le.id, le.learner_id, le.school_id, le.term_id, le.leaderboard_type, le.score, le.rank,
              u.full_name, u.grade, u.stream, s.name as school_name
       from leaderboard_entries le
       join users u on u.id = le.learner_id
       join schools s on s.id = le.school_id
       where ${where.join(" and ")}
       order by le.rank asc limit $${values.length - 1} offset $${values.length}`,
      values,
      `select count(*) from leaderboard_entries le where ${where.join(" and ")}`,
      values.slice(0, -2)
    ));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
