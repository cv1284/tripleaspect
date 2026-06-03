-- ============================================================
-- Brigid.pro — Migration 007: Progress Photos
-- ============================================================
--
-- Requires: Supabase Storage bucket named 'progress-photos'
-- Create it in the Supabase Dashboard → Storage → New bucket
-- Set to Public (so getPublicUrl works without signed URLs).
-- ============================================================

create table progress_photos (
  id           uuid        primary key default uuid_generate_v4(),
  client_id    uuid        not null references profiles(id) on delete cascade,
  storage_path text        not null,
  public_url   text        not null,
  notes        text,
  taken_at     date        not null default current_date,
  created_at   timestamptz not null default now()
);

alter table progress_photos enable row level security;

create index idx_progress_photos_client on progress_photos(client_id);
create index idx_progress_photos_date   on progress_photos(client_id, taken_at desc);

-- Clients: full access to own photos
create policy "photos_client_all" on progress_photos
  for all using (client_id = auth.uid());

-- PTs: read access to their clients' photos via agreement
create policy "photos_pt_read" on progress_photos
  for select using (
    exists (
      select 1 from client_agreements ca
      where ca.pt_id    = auth.uid()
        and ca.client_id = progress_photos.client_id
    )
  );
