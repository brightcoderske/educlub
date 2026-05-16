# Backend Permissions Map

This map follows `docs/LMS_System_Requirements_v1.3.md`, especially:

- Section 4.2: School Admin can allocate courses, create school typing tests, assign tests, and view learner progress for their school.
- Section 4.3: Learners can see active-term allocated courses, take assigned typing tests, and update their own progress only.

## Permission Entry Points

| Area | Route File | Service |
|---|---|---|
| Auth | `backend/routes/auth.routes.js` | `backend/services/auth.service.js` |
| Student dashboard and assigned courses | `backend/routes/student.routes.js` | `backend/services/student.service.js` |
| Course player access and progress | `backend/routes/courses.routes.js` | `backend/services/courseBuilder.service.js` + `backend/services/courseAccess.service.js` |
| School Admin course allocation | `backend/routes/schoolAdmin.routes.js` | `backend/services/schoolAdmin.service.js` |
| School Admin typing tests | `backend/routes/schoolAdmin.routes.js` | `backend/services/schoolAdmin.service.js` |
| System Admin global setup | `backend/routes/*.routes.js` | `backend/services/systemAdmin.service.js` |

## Course Access Rule

All course-player access should go through `backend/services/courseAccess.service.js`.

The rule is:

1. `system_admin` and `school_admin` can preview course content.
2. `student` users must have an active row in `enrolments`.
3. The lookup supports both database shapes seen in this repo:
   - `enrolments.learner_id = users.id`
   - `enrolments.learner_id = learner_profiles.id`

Do not reintroduce `course_enrolments`; the canonical allocation table is `enrolments`.

## Typing Test Rule

School Admin typing-test management is under:

- `GET /api/school-admin/typing/global-tests`
- `GET /api/school-admin/typing/school-tests`
- `POST /api/school-admin/typing/school-tests`
- `PATCH /api/school-admin/typing/school-tests/:id`
- `POST /api/school-admin/typing/tests/:id/assign`

The schema guard recreates missing typing tables before these services query them.

## Schema Guard Rule

`backend/utils/schemaGuard.js` is the self-healing compatibility layer for partially migrated databases.

It is cached per server process, so repeated dashboard/course requests do not keep running DDL.
