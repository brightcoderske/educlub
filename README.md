# EduClub LMS

EduClub is a co-curricular learning management system for schools, clubs, teachers, and learners.

This repository is intentionally scaffolded without dummy data. Real users, schools, terms, courses, questions, reports, and learner records must be created through approved application or operations workflows.

## Current Build Stage

- System Admin backend API wiring
- System Admin dashboard UI
- Supabase PostgreSQL schema
- No seed/demo records

## Local Setup

1. Create a backend `.env` from `.env.example`.
2. Apply `database/schema.sql` to the Supabase PostgreSQL database.
3. Create the initial System Admin account deliberately with real operator-provided values:

   ```bash
   cd backend
   npm run admin:create
   ```

   Required variables: `SYSTEM_ADMIN_FULL_NAME`, `SYSTEM_ADMIN_EMAIL`, and `SYSTEM_ADMIN_PASSWORD`.
   Re-running this command updates the matching System Admin account from those environment values instead of creating duplicates.

4. Create real School Admin accounts only after creating a real school:

   ```bash
   cd backend
   npm run school-admin:create
   ```

   Required variables: `SCHOOL_ADMIN_FULL_NAME`, `SCHOOL_ADMIN_EMAIL`, `SCHOOL_ADMIN_PASSWORD`, and `SCHOOL_ADMIN_SCHOOL_ID`.
4. Install dependencies in `backend` and `frontend`.
5. Run backend on port `4000`.
6. Run frontend on port `3000`.

## Database

The backend connects through `DATABASE_URL` using the Supabase PostgreSQL pooler. The schema enables row level security on all application tables and revokes direct table/function/sequence access from `anon` and `authenticated`.

## Roles

- `system_admin`
- `school_admin`
- `student`
