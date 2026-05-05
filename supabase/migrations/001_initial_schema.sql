-- ============================================================
-- Brigid.pro — Initial Schema Migration
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────
create type user_role         as enum ('pt', 'client');
create type agreement_status  as enum ('active', 'attention', 'paused', 'inactive');
create type agreement_model   as enum ('subscription', 'fixed_block', 'hybrid');
create type session_category  as enum ('healing', 'forging', 'verse');

-- ─── Profiles ─────────────────────────────────────────────
-- Extends Supabase auth.users (1:1)
create table profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  full_name   text,
  role        user_role   not null default 'client',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Exercise Library ─────────────────────────────────────
create table exercises (
  id                  uuid          primary key default uuid_generate_v4(),
  name                text          not null,
  description         text,
  category            session_category not null default 'forging',
  -- Public fallback GIF/video (CDN or Supabase Storage URL)
  default_video_url   text,
  -- PT-level custom YouTube override (resolved to embed via youtube.ts)
  custom_youtube_url  text,
  is_custom           boolean       not null default false,
  created_by_pt_id    uuid          references profiles(id) on delete set null,
  coaching_cues       text,
  tags                text[],
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

-- ─── Sessions ─────────────────────────────────────────────
create table sessions (
  id              uuid              primary key default uuid_generate_v4(),
  pt_id           uuid              not null references profiles(id) on delete cascade,
  client_id       uuid              not null references profiles(id) on delete cascade,
  title           text              not null,
  category        session_category  not null default 'forging',
  scheduled_date  date,
  completed_at    timestamptz,
  notes           text,
  created_at      timestamptz       not null default now(),
  updated_at      timestamptz       not null default now()
);

-- ─── Session Items ────────────────────────────────────────
-- prescribed_metrics JSONB shapes by category:
--
--   forging : { sets, reps, rest_seconds, tempo, weight_kg, rpe, notes }
--   healing : { sets, reps, hold_seconds, rest_seconds, side, frequency_per_day, notes }
--   verse   : { duration_minutes, distance_km, pace_per_km, heart_rate_zone, intervals, notes }
--
create table session_items (
  id                    uuid        primary key default uuid_generate_v4(),
  session_id            uuid        not null references sessions(id) on delete cascade,
  exercise_id           uuid        not null references exercises(id) on delete restrict,
  sort_order            integer     not null default 0,
  prescribed_metrics    jsonb       not null default '{}',
  -- Per-item overrides (take precedence over exercise-level values)
  custom_coaching_cues  text,
  custom_youtube_url    text,
  created_at            timestamptz not null default now()
);

-- ─── Client Agreements ────────────────────────────────────
create table client_agreements (
  id                      uuid              primary key default uuid_generate_v4(),
  client_id               uuid              not null references profiles(id) on delete cascade,
  pt_id                   uuid              not null references profiles(id) on delete cascade,

  -- Lifecycle
  status                  agreement_status  not null default 'active',
  agreement_model         agreement_model   not null default 'subscription',
  start_date              date              not null default current_date,
  renewal_date            date,
  program_length_weeks    integer,

  -- Onboarding compliance documents
  -- Storage URLs point to external providers (OneDrive / Google Drive / iCloud)
  parq_signed             boolean           not null default false,
  parq_storage_url        text,
  waiver_signed           boolean           not null default false,
  waiver_storage_url      text,
  consent_signed          boolean           not null default false,
  consent_storage_url     text,

  -- Manual billing (MVP — no Stripe dependency)
  manual_price_numeric    decimal(10, 2),
  manual_currency         varchar(3)        not null default 'GBP',
  billing_notes           text,

  -- Future Stripe integration placeholders
  stripe_customer_id      varchar(255),
  stripe_subscription_id  varchar(255),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One active agreement per client–PT pair
  unique (client_id, pt_id)
);

-- ─── updated_at Trigger ───────────────────────────────────
create or replace function fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function fn_set_updated_at();

create trigger trg_exercises_updated_at
  before update on exercises
  for each row execute function fn_set_updated_at();

create trigger trg_sessions_updated_at
  before update on sessions
  for each row execute function fn_set_updated_at();

create trigger trg_agreements_updated_at
  before update on client_agreements
  for each row execute function fn_set_updated_at();

-- ─── Indexes ──────────────────────────────────────────────
create index idx_sessions_client_id          on sessions(client_id);
create index idx_sessions_pt_id              on sessions(pt_id);
create index idx_sessions_scheduled_date     on sessions(scheduled_date);
create index idx_session_items_session_id    on session_items(session_id);
create index idx_session_items_sort          on session_items(session_id, sort_order);
create index idx_exercises_category          on exercises(category);
create index idx_exercises_created_by        on exercises(created_by_pt_id);
create index idx_exercises_tags              on exercises using gin(tags);
create index idx_session_metrics             on session_items using gin(prescribed_metrics);
create index idx_agreements_pt_id            on client_agreements(pt_id);
create index idx_agreements_client_id        on client_agreements(client_id);
create index idx_agreements_status           on client_agreements(status);
create index idx_agreements_renewal_date     on client_agreements(renewal_date);

-- ─── Row Level Security ───────────────────────────────────
alter table profiles          enable row level security;
alter table exercises         enable row level security;
alter table sessions          enable row level security;
alter table session_items     enable row level security;
alter table client_agreements enable row level security;

-- profiles
create policy "own_profile_read"   on profiles for select using (auth.uid() = id);
create policy "own_profile_update" on profiles for update using (auth.uid() = id);
create policy "pt_reads_clients"   on profiles for select using (
  exists (
    select 1 from client_agreements ca
    where ca.pt_id = auth.uid() and ca.client_id = id
  )
);

-- exercises: public exercises are universally readable; custom only by owning PT and their clients
create policy "exercises_public_read"   on exercises for select using (is_custom = false);
create policy "exercises_custom_read"   on exercises for select using (
  is_custom = true and (
    created_by_pt_id = auth.uid()
    or exists (
      select 1 from client_agreements ca
      where ca.client_id = auth.uid() and ca.pt_id = created_by_pt_id
    )
  )
);
create policy "exercises_pt_write" on exercises for all using (
  created_by_pt_id = auth.uid()
  and exists (select 1 from profiles where id = auth.uid() and role = 'pt')
);

-- sessions
create policy "sessions_pt_all"      on sessions for all   using (pt_id = auth.uid());
create policy "sessions_client_read" on sessions for select using (client_id = auth.uid());
create policy "sessions_client_complete" on sessions for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

-- session_items
create policy "items_pt_all" on session_items for all using (
  exists (select 1 from sessions s where s.id = session_id and s.pt_id = auth.uid())
);
create policy "items_client_read" on session_items for select using (
  exists (select 1 from sessions s where s.id = session_id and s.client_id = auth.uid())
);

-- client_agreements
create policy "agreements_pt_all"      on client_agreements for all   using (pt_id = auth.uid());
create policy "agreements_client_read" on client_agreements for select using (client_id = auth.uid());

-- ─── Seed: Base Exercise Library ─────────────────────────
insert into exercises (name, description, category, is_custom, tags) values
  -- FORGING
  ('Barbell Back Squat',      'Full depth compound squat',                      'forging', false, array['compound','legs','strength']),
  ('Conventional Deadlift',   'Hip-hinge pull from floor',                      'forging', false, array['compound','posterior-chain','strength']),
  ('Bench Press',             'Horizontal chest press',                         'forging', false, array['compound','push','chest']),
  ('Bent-Over Row',           'Horizontal pull, barbell',                       'forging', false, array['compound','pull','back']),
  ('Romanian Deadlift',       'Hip-hinge hamstring focus',                      'forging', false, array['hinge','hamstrings','strength']),
  ('Bulgarian Split Squat',   'Unilateral leg strength',                        'forging', false, array['unilateral','legs','strength']),
  ('Overhead Press',          'Vertical shoulder press',                        'forging', false, array['compound','push','shoulders']),
  ('Pull-Up',                 'Vertical pull, bodyweight',                      'forging', false, array['pull','back','bodyweight']),
  -- HEALING
  ('Hip Flexor Stretch',      'Kneeling hip flexor mobilisation',               'healing', false, array['mobility','hip','stretch']),
  ('Glute Bridge',            'Supine glute activation',                        'healing', false, array['activation','glute','hip']),
  ('Thoracic Rotation',       'Seated or quadruped thoracic mob',               'healing', false, array['mobility','thoracic','rotation']),
  ('Dead Bug',                'Anti-extension core stability',                  'healing', false, array['stability','core','anti-extension']),
  ('Side-Lying Clamshell',    'Glute med activation',                           'healing', false, array['activation','glute-med','hip']),
  ('Wall Ankle Mobilisation', 'Tibial glide ankle mob',                         'healing', false, array['mobility','ankle','lower-leg']),
  -- VERSE
  ('Box Breathing',           '4-4-4-4 inhale-hold-exhale-hold protocol',       'verse',   false, array['breathwork','nervous-system','parasympathetic']),
  ('Zone 2 Run',              'Aerobic base: conversational pace',               'verse',   false, array['cardio','aerobic','endurance']),
  ('Cold Exposure Protocol',  'Progressive cold water immersion',               'verse',   false, array['cold','recovery','resilience']),
  ('Gratitude Journaling',    '5-minute morning reflection protocol',           'verse',   false, array['mindset','journaling','habits']),
  ('Progressive Muscle Relax','Systematic tension-release body scan',           'verse',   false, array['recovery','stress','sleep']);
