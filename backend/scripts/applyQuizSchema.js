require("dotenv").config();

const { query, pool } = require("../config/database");

const sql = `
alter table quizzes add column if not exists is_global boolean not null default false;
alter table quizzes add column if not exists grade_levels integer[] not null default '{}';
alter table quizzes add column if not exists max_attempts integer not null default 1;
alter table quizzes add column if not exists total_points integer not null default 100;
alter table quizzes add column if not exists deleted_at timestamptz;

alter table quiz_attempts add column if not exists assignment_id uuid;
alter table quiz_attempts add column if not exists attempt_number integer not null default 1;
alter table quiz_attempts add column if not exists answers jsonb not null default '{}'::jsonb;

create table if not exists quiz_assignments (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  term_id uuid references terms(id) on delete restrict,
  grade integer not null check (grade between 1 and 9),
  assigned_by uuid references users(id) on delete set null,
  max_attempts integer not null default 1 check (max_attempts between 1 and 20),
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  unique (quiz_id, school_id, term_id, grade)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'quiz_attempts_assignment_id_fkey'
  ) then
    alter table quiz_attempts
      add constraint quiz_attempts_assignment_id_fkey
      foreign key (assignment_id) references quiz_assignments(id) on delete set null;
  end if;
end $$;

alter table quiz_assignments enable row level security;
`;

async function main() {
  await query(sql);
  console.log("Quiz workflow schema applied.");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
