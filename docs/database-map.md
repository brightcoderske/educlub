# Database Map

This schema follows `docs/LMS_System_Requirements_v1.3.md`.

## Core School Model

| Table | Purpose |
|---|---|
| `academic_years` | Academic year records. |
| `terms` | Term 1/2/3 definitions and global active term. |
| `schools` | School accounts, status, contact, logo, clubs. |
| `school_active_terms` | Compatibility table for school term activation history. |
| `users` | System Admin, School Admin, and Student accounts. |
| `learner_profiles` | Learner metadata used by allocation compatibility paths. |
| `grade_history` | Grade/stream promotion audit. |

## Course And Learning

| Table | Purpose |
|---|---|
| `courses` | Global course catalogue. |
| `modules` | Course modules. |
| `lessons` | Module lessons and legacy lesson content. |
| `lesson_activity_blocks` | Current course-builder activity blocks. |
| `enrolments` | Active-term learner course allocations. |
| `lesson_progress` | Learner lesson progress, score, XP, and activity progress. |
| `course_module_availability` | School-specific module lock/unlock scheduling. |

## Assessment

| Table | Purpose |
|---|---|
| `quiz_questions` | Global and school quiz question pool. |
| `quiz_question_school_visibility` | Visibility of global questions by school. |
| `quizzes` | Global and school quizzes. |
| `quiz_items` | Questions attached to quizzes. |
| `quiz_assignments` | Term/grade quiz assignments. |
| `quiz_attempts` | Learner quiz attempts. |
| `typing_tests` | Global and school typing tests. |
| `typing_assignments` | Term/grade typing assignments. |
| `typing_attempts` | Current learner typing attempt records. |
| `typing_results` | Legacy typing results kept for historical reports. |

## Reporting And Admin

| Table | Purpose |
|---|---|
| `submissions` | Project/file submissions and teacher review status. |
| `report_cards` | Term report-card snapshots and PDFs. |
| `leaderboard_entries` | Stored leaderboard rows; dynamic quiz/typing leaderboards are also computed from attempts. |
| `school_preferences` | School-specific report, typing, quiz, and notification settings. |
| `school_streams` | School class streams. |
| `audit_logs` | Admin action audit trail. |

## Removed Legacy Tables

These were removed from the canonical schema and dropped from the live DB with `npm run db:cleanup-legacy`:

- `practice_tasks`
- `school_lesson_annotations`

The cleanup SQL is in `database/cleanup_legacy.sql`.
