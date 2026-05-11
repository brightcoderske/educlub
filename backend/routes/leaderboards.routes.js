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
    const dynamicWhere = where.map((clause) => clause.replace(/le\./g, "c."));
    res.json(await list(
      `with quiz_scores as (
         select qa.learner_id, qa.school_id, qa.term_id, max(qa.score)::numeric as score, max(qa.created_at) as created_at
         from quiz_attempts qa
         group by qa.learner_id, qa.school_id, qa.term_id
       ),
       quiz_ranked as (
         select concat('quiz-', qs.term_id, '-', qs.learner_id) as id, qs.learner_id, qs.school_id, qs.term_id,
                'quiz'::text as leaderboard_type, qs.score,
                dense_rank() over (partition by qs.school_id, qs.term_id order by qs.score desc, qs.created_at asc)::int as rank,
                qs.created_at
         from quiz_scores qs
       ),
       typing_ranked as (
         select concat('typing-', ts.term_id, '-', ts.learner_id) as id, ts.learner_id, ts.school_id, ts.term_id,
                'typing'::text as leaderboard_type, ts.score,
                dense_rank() over (partition by ts.school_id, ts.term_id order by ts.score desc, ts.accuracy desc, ts.created_at asc)::int as rank,
                ts.created_at
         from (
           select distinct on (learner_id, school_id, term_id)
                  learner_id, school_id, term_id, wpm::numeric as score, accuracy::numeric as accuracy, created_at
           from (
             select learner_id, school_id, term_id, wpm, accuracy, created_at from typing_results
             union all
             select learner_id, school_id, term_id, wpm, accuracy, created_at from typing_attempts
           ) typing_source
           order by learner_id, school_id, term_id, wpm desc, accuracy desc, created_at asc
         ) ts
       ),
       stored_ranked as (
         select le.id::text, le.learner_id, le.school_id, le.term_id, le.leaderboard_type, le.score, le.rank, le.created_at
         from leaderboard_entries le
         where le.leaderboard_type not in ('quiz', 'typing')
       ),
       combined as (
         select * from stored_ranked
         union all select * from quiz_ranked
         union all select * from typing_ranked
       )
       select c.id, c.learner_id, c.school_id, c.term_id, c.leaderboard_type, c.score, c.rank, c.created_at,
              coalesce(u.full_name, u.name) as full_name, u.grade, u.stream, s.name as school_name
       from combined c
       join users u on u.id = c.learner_id
       join schools s on s.id = c.school_id
       where ${dynamicWhere.join(" and ")}
       order by c.leaderboard_type, c.rank asc, coalesce(u.full_name, u.name)
       limit $${values.length - 1} offset $${values.length}`,
      values,
      `with quiz_scores as (
         select qa.learner_id, qa.school_id, qa.term_id, max(qa.score)::numeric as score, max(qa.created_at) as created_at
         from quiz_attempts qa
         group by qa.learner_id, qa.school_id, qa.term_id
       ),
       quiz_ranked as (
         select concat('quiz-', qs.term_id, '-', qs.learner_id) as id, qs.learner_id, qs.school_id, qs.term_id,
                'quiz'::text as leaderboard_type, qs.score,
                dense_rank() over (partition by qs.school_id, qs.term_id order by qs.score desc, qs.created_at asc)::int as rank,
                qs.created_at
         from quiz_scores qs
       ),
       typing_ranked as (
         select concat('typing-', ts.term_id, '-', ts.learner_id) as id, ts.learner_id, ts.school_id, ts.term_id,
                'typing'::text as leaderboard_type, ts.score,
                dense_rank() over (partition by ts.school_id, ts.term_id order by ts.score desc, ts.accuracy desc, ts.created_at asc)::int as rank,
                ts.created_at
         from (
           select distinct on (learner_id, school_id, term_id)
                  learner_id, school_id, term_id, wpm::numeric as score, accuracy::numeric as accuracy, created_at
           from (
             select learner_id, school_id, term_id, wpm, accuracy, created_at from typing_results
             union all
             select learner_id, school_id, term_id, wpm, accuracy, created_at from typing_attempts
           ) typing_source
           order by learner_id, school_id, term_id, wpm desc, accuracy desc, created_at asc
         ) ts
       ),
       stored_ranked as (
         select le.id::text, le.learner_id, le.school_id, le.term_id, le.leaderboard_type, le.score, le.rank, le.created_at
         from leaderboard_entries le
         where le.leaderboard_type not in ('quiz', 'typing')
       ),
       combined as (
         select * from stored_ranked
         union all select * from quiz_ranked
         union all select * from typing_ranked
       )
       select count(*) from combined c where ${dynamicWhere.join(" and ")}`,
      values.slice(0, -2)
    ));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
