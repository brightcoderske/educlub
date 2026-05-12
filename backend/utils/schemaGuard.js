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

      course_id uuid not null references courses(id) on delete cascade,

      module_id uuid not null references modules(id) on delete cascade,

      available_from timestamptz,

      created_by uuid references users(id) on delete set null,

      created_at timestamptz not null default now(),

      updated_at timestamptz not null default now(),

      unique (school_id, module_id)

    )

  `);

}



async function ensureCourseBuilderSchema(db) {

  await db.query("alter table courses add column if not exists short_description text");

  await db.query("alter table courses add column if not exists cover_image_url text");

  await db.query("alter table courses add column if not exists target_level text");

  await db.query("alter table courses add column if not exists technology text");

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

  await db.query("alter table typing_tests add column if not exists max_attempts integer not null default 3");

  await db.query("alter table typing_attempts add column if not exists raw_answer text not null default ''");

}



module.exports = { ensureCourseColumns, ensureTypingColumns, ensureCourseBuilderSchema };

