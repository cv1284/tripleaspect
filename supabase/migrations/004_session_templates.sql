-- ============================================================
-- 004_session_templates.sql
-- PT session template library with optional public sharing
-- Run in Supabase SQL editor: Dashboard → SQL Editor → New query
-- ============================================================

create table if not exists session_templates (
  id          uuid primary key default gen_random_uuid(),
  pt_id       uuid not null references profiles(id) on delete cascade,
  pt_name     text,              -- denormalized at save time for public display
  title       text not null,
  category    text not null,     -- 'healing' | 'forging' | 'verse'
  notes       text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists session_template_items (
  id                   uuid primary key default gen_random_uuid(),
  template_id          uuid not null references session_templates(id) on delete cascade,
  exercise_id          uuid not null references exercises(id),
  sort_order           integer not null default 0,
  prescribed_metrics   jsonb not null default '{}',
  custom_coaching_cues text,
  custom_youtube_url   text,
  created_at           timestamptz not null default now()
);

-- Indexes
create index if not exists session_templates_pt_id_idx    on session_templates(pt_id);
create index if not exists session_templates_is_public_idx on session_templates(is_public) where is_public = true;
create index if not exists session_template_items_tmpl_idx on session_template_items(template_id);

-- RLS
alter table session_templates      enable row level security;
alter table session_template_items enable row level security;

-- PT can read their own templates + all public templates
create policy "pt_reads_templates" on session_templates
  for select using (
    pt_id = auth.uid() or is_public = true
  );

-- PT can insert their own templates
create policy "pt_inserts_templates" on session_templates
  for insert with check (pt_id = auth.uid());

-- PT can update/delete their own templates
create policy "pt_updates_templates" on session_templates
  for update using (pt_id = auth.uid());

create policy "pt_deletes_templates" on session_templates
  for delete using (pt_id = auth.uid());

-- Template items: readable if the parent template is readable
create policy "pt_reads_template_items" on session_template_items
  for select using (
    exists (
      select 1 from session_templates t
      where t.id = template_id
        and (t.pt_id = auth.uid() or t.is_public = true)
    )
  );

create policy "pt_inserts_template_items" on session_template_items
  for insert with check (
    exists (
      select 1 from session_templates t
      where t.id = template_id and t.pt_id = auth.uid()
    )
  );

create policy "pt_deletes_template_items" on session_template_items
  for delete using (
    exists (
      select 1 from session_templates t
      where t.id = template_id and t.pt_id = auth.uid()
    )
  );
