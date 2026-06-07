-- ============================================================
-- Migration 009 — Wellbeing Check-ins
-- ============================================================
-- Pre-session check-in: sleep quality, stress level, soreness.
-- Scores 1–5 (1 = poor/high, 5 = excellent/low for sleep/soreness;
-- 1 = low, 5 = high for stress — stored raw, UI labels handle semantics).

create table wellbeing_checkins (
  id          uuid      primary key default uuid_generate_v4(),
  client_id   uuid      not null references profiles(id) on delete cascade,
  session_id  uuid      references sessions(id) on delete set null,
  sleep       smallint  not null check (sleep between 1 and 5),
  stress      smallint  not null check (stress between 1 and 5),
  soreness    smallint  not null check (soreness between 1 and 5),
  notes       text,
  created_at  timestamptz not null default now()
);

alter table wellbeing_checkins enable row level security;

-- Client: full access to own check-ins
create policy "checkin_client_all" on wellbeing_checkins
  for all using (client_id = auth.uid());

-- PT: read-only access to their clients' check-ins
create policy "checkin_pt_read" on wellbeing_checkins
  for select using (
    exists (
      select 1 from client_agreements ca
      where ca.client_id = wellbeing_checkins.client_id
        and ca.pt_id = auth.uid()
    )
  );

create index idx_wellbeing_client_id  on wellbeing_checkins(client_id);
create index idx_wellbeing_session_id on wellbeing_checkins(session_id);
create index idx_wellbeing_created_at on wellbeing_checkins(client_id, created_at desc);
