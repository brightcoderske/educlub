-- EduClub legacy database cleanup.
--
-- Run this only after applying database/schema.sql and confirming the app is on
-- the current codebase. These tables are not used by the current route/service
-- layer and were removed from the canonical schema.

drop table if exists practice_tasks cascade;
drop table if exists school_lesson_annotations cascade;
