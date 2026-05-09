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
      where.push(`e.school_id = $${values.length}`);
    }
    if (req.query.term_id) {
      values.push(req.query.term_id);
      where.push(`e.term_id = $${values.length}`);
    }
    if (req.query.course_id) {
      values.push(req.query.course_id);
      where.push(`e.course_id = $${values.length}`);
    }
    values.push(limit, offset);
    res.json(await list(
      `select e.id, e.learner_id, e.school_id, e.course_id, e.term_id, e.status, e.created_at,
              u.full_name, u.grade, u.stream, c.name as course_name, s.name as school_name, t.name as term_name
       from enrolments e
       join users u on u.id = e.learner_id
       join courses c on c.id = e.course_id
       join schools s on s.id = e.school_id
       join terms t on t.id = e.term_id
       where ${where.join(" and ")}
       order by e.created_at desc limit $${values.length - 1} offset $${values.length}`,
      values,
      `select count(*) from enrolments e where ${where.join(" and ")}`,
      values.slice(0, -2)
    ));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
