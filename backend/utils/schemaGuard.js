const schemaChecks = new Map();

function runSchemaCheckOnce(key, task) {
  if (schemaChecks.has(key)) return schemaChecks.get(key);

  const check = task().catch((error) => {
    schemaChecks.delete(key);
    throw error;
  });

  schemaChecks.set(key, check);
  return check;
}

async function ensureLearnerProfilesSchema(db) {
  await db.query(`
    create table if not exists learner_profiles (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      school_id uuid not null references schools(id) on delete cascade,
      full_name text not null,
      grade text,
      stream text,
      parent_name text,
      parent_email text,
      parent_phone text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (user_id)
    )
  `);

  await db.query("create index if not exists learner_profiles_school_idx on learner_profiles (school_id)");
}

async function ensureCourseColumns(db) {

  await db.query("alter table courses add column if not exists title text");

  await db.query("alter table courses add column if not exists description text");

  await db.query("alter table courses add column if not exists status text not null default 'draft'");

  await db.query("alter table courses add column if not exists is_coming_soon boolean not null default false");

  await db.query("alter table modules add column if not exists name text");

  await db.query("alter table modules add column if not exists title text");

  await db.query("alter table modules add column if not exists description text");

  await db.query("alter table modules add column if not exists objectives text");

  await db.query("alter table modules add column if not exists sort_order integer not null default 1");

  await db.query("alter table modules add column if not exists pass_threshold numeric(5,2)");

  await db.query("alter table modules add column if not exists available_from timestamptz");

  await db.query("alter table modules add column if not exists badge_name text");

  await db.query("alter table modules add column if not exists xp_points integer not null default 50");

  await db.query("alter table modules add column if not exists created_at timestamptz not null default now()");

  await db.query("alter table modules add column if not exists updated_at timestamptz not null default now()");

  await db.query("alter table lessons add column if not exists created_at timestamptz not null default now()");

  await db.query("alter table lessons add column if not exists updated_at timestamptz not null default now()");

  await db.query("alter table lessons add column if not exists name text");

  await db.query("alter table lessons add column if not exists title text");

  await db.query(`

    do $$

    begin

      if exists (

        select 1 from information_schema.columns

        where table_schema = 'public'

          and table_name = 'lessons'

          and column_name = 'content'

          and data_type <> 'jsonb'

      ) then

        alter table lessons

          alter column content drop default,

          alter column content type jsonb using jsonb_build_object('notes', content),

          alter column content set default '{}'::jsonb;

      end if;

    end $$;

  `);

  await db.query("alter table lessons add column if not exists content jsonb not null default '{}'::jsonb");

  await db.query("alter table lessons add column if not exists description text");

  await db.query("alter table lessons add column if not exists example text");

  await db.query("alter table lessons add column if not exists sort_order integer not null default 1");

  await db.query("alter table lessons add column if not exists learning_notes text");

  await db.query("alter table lessons add column if not exists practice_prompt text");

  await db.query("alter table lessons add column if not exists starter_code text");

  await db.query("alter table lessons add column if not exists homework_prompt text");

  await db.query("alter table lessons add column if not exists creativity_prompt text");

  await db.query("alter table lessons add column if not exists quiz jsonb not null default '[]'::jsonb");

  await db.query("alter table lessons add column if not exists xp_points integer not null default 20");

  await db.query("update modules set title = coalesce(title, name, 'Untitled module'), name = coalesce(name, title, 'Untitled module'), description = coalesce(description, objectives), objectives = coalesce(objectives, description)");

  await db.query("update lessons set title = coalesce(title, name, 'Untitled lesson'), name = coalesce(name, title, 'Untitled lesson'), description = coalesce(description, content->>'notes')");

  await ensureCourseBuilderSchema(db);



  await db.query(`

    create table if not exists course_module_availability (

      id uuid primary key default gen_random_uuid(),

      school_id uuid not null references schools(id) on delete cascade,

      term_id uuid references terms(id) on delete cascade,

      course_id uuid not null references courses(id) on delete cascade,

      module_id uuid not null references modules(id) on delete cascade,

      week_number integer,

      available_from timestamptz,

      created_by uuid references users(id) on delete set null,

      created_at timestamptz not null default now(),

      updated_at timestamptz not null default now(),

      unique (school_id, module_id)

    )

  `);

  await db.query("alter table course_module_availability add column if not exists term_id uuid references terms(id) on delete cascade");

  await db.query("alter table course_module_availability add column if not exists week_number integer");

}



async function ensureCourseBuilderSchema(db) {
  await ensureLearnerProfilesSchema(db);

  await db.query("alter table courses add column if not exists short_description text");

  await db.query("alter table courses add column if not exists cover_image_url text");

  await db.query("alter table courses add column if not exists target_level text");

  await db.query("alter table courses add column if not exists technology text");

  await db.query("alter table courses add column if not exists about text");

  await db.query("alter table courses add column if not exists learnings jsonb default '[]'::jsonb");

  await db.query("alter table courses add column if not exists thumbnail_type varchar(20) default 'image'");

  await db.query("alter table courses add column if not exists meta_title varchar(200)");

  await db.query("alter table courses add column if not exists meta_description text");

  await db.query("alter table courses add column if not exists meta_keywords text");

  await db.query("alter table courses add column if not exists public boolean default false");

  await db.query("alter table quiz_assignments add column if not exists week_number integer");

  await db.query("alter table modules add column if not exists icon_url text");

  await db.query("alter table modules add column if not exists total_marks numeric(6,2) not null default 100");

  await db.query("alter table lessons add column if not exists lesson_objectives text");

  await db.query("alter table lessons add column if not exists total_marks numeric(6,2) not null default 100");

  await db.query("alter table lesson_progress add column if not exists activity_progress jsonb not null default '{}'::jsonb");

  await db.query("alter table lesson_progress add column if not exists score_breakdown jsonb not null default '{}'::jsonb");

  await db.query(`

    create table if not exists lesson_activity_blocks (

      id uuid primary key default gen_random_uuid(),

      lesson_id uuid not null references lessons(id) on delete cascade,

      activity_type text not null,

      sort_order integer not null default 1,

      marks_weight numeric(6,2) not null default 0,

      payload jsonb not null default '{}'::jsonb,

      created_at timestamptz not null default now(),

      updated_at timestamptz not null default now()

    )

  `);

  await db.query(

    "create index if not exists lesson_activity_blocks_lesson_order_idx on lesson_activity_blocks (lesson_id, sort_order)"

  );

}



async function ensureTypingColumns(db) {

  await db.query(`
    create table if not exists typing_tests (
      id uuid primary key default gen_random_uuid(),
      school_id uuid references schools(id) on delete cascade,
      title text not null,
      passage text not null,
      duration_seconds integer not null default 300,
      grade_levels integer[] not null default '{}',
      max_attempts integer not null default 3,
      is_global boolean not null default false,
      is_published boolean not null default true,
      created_by uuid references users(id) on delete set null,
      deleted_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query(`
    create table if not exists typing_assignments (
      id uuid primary key default gen_random_uuid(),
      typing_test_id uuid not null references typing_tests(id) on delete cascade,
      school_id uuid not null references schools(id) on delete cascade,
      term_id uuid references terms(id) on delete restrict,
      grade integer not null check (grade between 1 and 9),
      assigned_by uuid references users(id) on delete set null,
      week_number integer,
      available_from timestamptz,
      available_until timestamptz,
      is_active boolean not null default true,
      assigned_at timestamptz not null default now(),
      unique (typing_test_id, school_id, term_id, grade)
    )
  `);

  await db.query(`
    create table if not exists typing_attempts (
      id uuid primary key default gen_random_uuid(),
      typing_test_id uuid not null references typing_tests(id) on delete cascade,
      assignment_id uuid references typing_assignments(id) on delete set null,
      learner_id uuid not null references users(id) on delete cascade,
      school_id uuid not null references schools(id) on delete cascade,
      term_id uuid not null references terms(id) on delete restrict,
      wpm numeric(6,2) not null,
      accuracy numeric(5,2) not null,
      time_taken_seconds integer not null,
      typed_text text,
      raw_answer text not null default '',
      created_at timestamptz not null default now()
    )
  `);

  await db.query("alter table typing_tests add column if not exists max_attempts integer not null default 3");

  await db.query("alter table typing_attempts add column if not exists raw_answer text not null default ''");

  await db.query("alter table typing_assignments add column if not exists week_number integer");

}

async function ensureTwoFactorSchema(db) {
  await db.query(`
    create table if not exists login_2fa_challenges (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      code_hash text not null,
      attempts integer not null default 0,
      expires_at timestamptz not null,
      consumed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await db.query("alter table login_2fa_challenges add column if not exists user_id uuid references users(id) on delete cascade");
  await db.query("alter table login_2fa_challenges add column if not exists code_hash text");
  await db.query("alter table login_2fa_challenges add column if not exists attempts integer not null default 0");
  await db.query("alter table login_2fa_challenges add column if not exists expires_at timestamptz");
  await db.query("alter table login_2fa_challenges add column if not exists consumed_at timestamptz");
  await db.query("alter table login_2fa_challenges add column if not exists created_at timestamptz not null default now()");
  await db.query("alter table login_2fa_challenges add column if not exists updated_at timestamptz not null default now()");
  await db.query(`
    create index if not exists login_2fa_challenges_user_active_idx
      on login_2fa_challenges (user_id, expires_at)
      where consumed_at is null
  `);
}



module.exports = {
  ensureCourseColumns: (db) => runSchemaCheckOnce("course_columns", () => ensureCourseColumns(db)),
  ensureTypingColumns: (db) => runSchemaCheckOnce("typing_schema", () => ensureTypingColumns(db)),
  ensureCourseBuilderSchema: (db) => runSchemaCheckOnce("course_builder", () => ensureCourseBuilderSchema(db)),
  ensureLearnerProfilesSchema: (db) => runSchemaCheckOnce("learner_profiles", () => ensureLearnerProfilesSchema(db)),
  ensureTwoFactorSchema: (db) => runSchemaCheckOnce("two_factor_schema", () => ensureTwoFactorSchema(db))
};

