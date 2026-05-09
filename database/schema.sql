create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('system_admin', 'school_admin', 'student');
  end if;

  if not exists (select 1 from pg_type where typname = 'term_name') then
    create type term_name as enum ('Term 1', 'Term 2', 'Term 3');
  end if;
end $$;

create table if not exists academic_years (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table academic_years add column if not exists year integer;
alter table academic_years add column if not exists created_at timestamptz not null default now();
alter table academic_years add column if not exists updated_at timestamptz not null default now();

create table if not exists terms (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete restrict,
  name term_name not null,
  starts_on date not null,
  ends_on date not null,
  is_global_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, name),
  check (starts_on <= ends_on)
);

alter table terms add column if not exists academic_year_id uuid references academic_years(id) on delete restrict;
alter table terms add column if not exists name term_name;
alter table terms add column if not exists starts_on date;
alter table terms add column if not exists ends_on date;
alter table terms add column if not exists is_global_active boolean not null default false;
alter table terms add column if not exists created_at timestamptz not null default now();
alter table terms add column if not exists updated_at timestamptz not null default now();

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  logo_url text,
  clubs text[] not null default '{}',
  is_active boolean not null default true,
  suspended_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table schools add column if not exists contact_email text;
alter table schools add column if not exists logo_url text;
alter table schools add column if not exists clubs text[] not null default '{}';
alter table schools add column if not exists is_active boolean not null default true;
alter table schools add column if not exists suspended_at timestamptz;
alter table schools add column if not exists deleted_at timestamptz;
alter table schools add column if not exists created_at timestamptz not null default now();
alter table schools add column if not exists updated_at timestamptz not null default now();

create table if not exists school_active_terms (
  school_id uuid primary key references schools(id) on delete cascade,
  term_id uuid not null references terms(id) on delete restrict,
  activated_by uuid,
  activated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete restrict,
  role user_role not null,
  full_name text not null,
  email text,
  username text,
  password_hash text not null,
  force_password_change boolean not null default true,
  two_factor_enabled boolean not null default false,
  is_active boolean not null default true,
  grade integer,
  stream text,
  date_of_birth date,
  parent_name text,
  parent_email text,
  parent_phone text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (role in ('system_admin', 'school_admin') and email is not null)
    or (role = 'student' and username is not null)
  )
);

alter table users add column if not exists school_id uuid references schools(id) on delete restrict;
alter table users add column if not exists role user_role not null default 'student';
alter table users add column if not exists full_name text;
alter table users add column if not exists email text;
alter table users add column if not exists username text;
alter table users add column if not exists password_hash text;
alter table users add column if not exists force_password_change boolean not null default true;
alter table users add column if not exists two_factor_enabled boolean not null default false;
alter table users add column if not exists is_active boolean not null default true;
alter table users add column if not exists grade integer;
alter table users add column if not exists stream text;
alter table users add column if not exists date_of_birth date;
alter table users add column if not exists parent_name text;
alter table users add column if not exists parent_email text;
alter table users add column if not exists parent_phone text;
alter table users add column if not exists deleted_at timestamptz;
alter table users add column if not exists created_at timestamptz not null default now();
alter table users add column if not exists updated_at timestamptz not null default now();

create unique index if not exists users_email_unique_active
  on users (lower(email))
  where email is not null and deleted_at is null;

create unique index if not exists users_school_username_unique_active
  on users (school_id, lower(username))
  where username is not null and deleted_at is null;

create table if not exists grade_history (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  old_grade integer,
  new_grade integer,
  old_stream text,
  new_stream text,
  approved_by uuid references users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  objectives text,
  club text,
  is_published boolean not null default false,
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table courses add column if not exists name text;
alter table courses add column if not exists objectives text;
alter table courses add column if not exists club text;
alter table courses add column if not exists is_published boolean not null default false;
alter table courses add column if not exists published_at timestamptz;
alter table courses add column if not exists deleted_at timestamptz;
alter table courses add column if not exists created_at timestamptz not null default now();
alter table courses add column if not exists updated_at timestamptz not null default now();

create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  name text not null,
  objectives text,
  sort_order integer not null,
  pass_threshold numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, sort_order)
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  name text not null,
  content text,
  example text,
  video_url text,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, sort_order)
);

create table if not exists school_lesson_annotations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  example_override text,
  annotation text,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, lesson_id)
);

create table if not exists practice_tasks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  task_type text not null check (task_type in ('quiz', 'file_submission')),
  title text not null,
  prompt text,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

create table if not exists enrolments (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  course_id uuid not null references courses(id) on delete restrict,
  term_id uuid not null references terms(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'inactive', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, course_id, term_id)
);

create table if not exists lesson_progress (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  module_id uuid not null references modules(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  score numeric(5,2),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (learner_id, lesson_id)
);

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option char(1) not null check (correct_option in ('A', 'B', 'C', 'D')),
  is_global boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quiz_question_school_visibility (
  question_id uuid not null references quiz_questions(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, school_id)
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete cascade,
  term_id uuid references terms(id) on delete restrict,
  title text not null,
  description text,
  time_limit_seconds integer,
  randomise_order boolean not null default false,
  is_published boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quiz_items (
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question_id uuid not null references quiz_questions(id) on delete restrict,
  sort_order integer not null,
  primary key (quiz_id, question_id)
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references quizzes(id) on delete cascade,
  learner_id uuid not null references users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  term_id uuid not null references terms(id) on delete restrict,
  score numeric(5,2) not null,
  time_taken_seconds integer,
  created_at timestamptz not null default now()
);

create table if not exists typing_results (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  term_id uuid not null references terms(id) on delete restrict,
  wpm numeric(6,2) not null,
  accuracy numeric(5,2) not null,
  time_taken_seconds integer not null,
  raw_answer text,
  created_at timestamptz not null default now(),
  unique (learner_id, term_id)
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  term_id uuid not null references terms(id) on delete restrict,
  lesson_id uuid references lessons(id) on delete set null,
  file_url text not null,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed')),
  feedback text,
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table submissions add column if not exists learner_id uuid references users(id) on delete cascade;
alter table submissions add column if not exists school_id uuid references schools(id) on delete cascade;
alter table submissions add column if not exists term_id uuid references terms(id) on delete restrict;
alter table submissions add column if not exists lesson_id uuid references lessons(id) on delete set null;
alter table submissions add column if not exists file_url text;
alter table submissions add column if not exists status text not null default 'submitted';
alter table submissions add column if not exists feedback text;
alter table submissions add column if not exists reviewed_by uuid references users(id) on delete set null;
alter table submissions add column if not exists reviewed_at timestamptz;
alter table submissions add column if not exists created_at timestamptz not null default now();

create table if not exists report_cards (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  term_id uuid not null references terms(id) on delete restrict,
  pdf_url text,
  snapshot jsonb not null default '{}'::jsonb,
  teacher_remarks text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (learner_id, term_id)
);

create table if not exists leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  term_id uuid references terms(id) on delete restrict,
  leaderboard_type text not null check (leaderboard_type in ('course', 'module', 'quiz', 'typing', 'xp')),
  score numeric(10,2) not null,
  rank integer not null,
  created_at timestamptz not null default now()
);

create table if not exists school_preferences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references schools(id) on delete cascade,
  typing_passage_words integer not null default 300 check (typing_passage_words between 300 and 500),
  typing_timer_seconds integer not null default 300 check (typing_timer_seconds between 300 and 500),
  module_pass_threshold numeric(5,2) not null default 60,
  leaderboards_visible boolean not null default true,
  ai_enabled boolean not null default false,
  notification_preferences jsonb not null default '{}'::jsonb,
  report_header_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  actor_role text,
  action text not null,
  target_type text,
  target_id uuid,
  school_id uuid references schools(id) on delete set null,
  term_id uuid references terms(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs add column if not exists actor_user_id uuid references users(id) on delete set null;
alter table audit_logs add column if not exists actor_role text;
alter table audit_logs add column if not exists action text;
alter table audit_logs add column if not exists target_type text;
alter table audit_logs add column if not exists target_id uuid;
alter table audit_logs add column if not exists school_id uuid references schools(id) on delete set null;
alter table audit_logs add column if not exists term_id uuid references terms(id) on delete set null;
alter table audit_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table audit_logs add column if not exists created_at timestamptz not null default now();

create or replace function system_admin_school_performance(p_term_id uuid default null)
returns table (
  school_id uuid,
  school_name text,
  enrolment_count bigint,
  average_quiz_score numeric,
  average_typing_wpm numeric,
  completion_count bigint
)
language sql
stable
as $$
  select
    s.id as school_id,
    s.name as school_name,
    count(distinct e.id) as enrolment_count,
    avg(qa.score) as average_quiz_score,
    avg(tr.wpm) as average_typing_wpm,
    count(distinct e.id) filter (where e.status = 'completed') as completion_count
  from schools s
  left join enrolments e
    on e.school_id = s.id
    and (p_term_id is null or e.term_id = p_term_id)
  left join quiz_attempts qa
    on qa.school_id = s.id
    and (p_term_id is null or qa.term_id = p_term_id)
  left join typing_results tr
    on tr.school_id = s.id
    and (p_term_id is null or tr.term_id = p_term_id)
  where s.deleted_at is null
  group by s.id, s.name
  order by s.name;
$$;

revoke all on schema public from public;
grant usage on schema public to postgres;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

alter table academic_years enable row level security;
alter table terms enable row level security;
alter table schools enable row level security;
alter table school_active_terms enable row level security;
alter table users enable row level security;
alter table grade_history enable row level security;
alter table courses enable row level security;
alter table modules enable row level security;
alter table lessons enable row level security;
alter table school_lesson_annotations enable row level security;
alter table practice_tasks enable row level security;
alter table enrolments enable row level security;
alter table lesson_progress enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_question_school_visibility enable row level security;
alter table quizzes enable row level security;
alter table quiz_items enable row level security;
alter table quiz_attempts enable row level security;
alter table typing_results enable row level security;
alter table submissions enable row level security;
alter table report_cards enable row level security;
alter table leaderboard_entries enable row level security;
alter table school_preferences enable row level security;
alter table audit_logs enable row level security;
