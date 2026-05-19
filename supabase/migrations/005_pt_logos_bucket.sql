-- ============================================================
-- 005_pt_logos_bucket.sql
-- Supabase Storage bucket for PT logo / brand mark uploads
--
-- Run in Supabase SQL editor: Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Create the bucket (public so logos can be embedded anywhere)
insert into storage.buckets (id, name, public)
values ('pt-logos', 'pt-logos', true)
on conflict (id) do nothing;

-- 2. Allow authenticated PTs to upload/replace their own logo
--    Path pattern: {userId}/logo.{ext}
create policy "pt_upload_own_logo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pt-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "pt_update_own_logo" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pt-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "pt_delete_own_logo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pt-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Public read (no auth required — logos appear in client-facing template cards)
create policy "public_read_logos" on storage.objects
  for select
  using (bucket_id = 'pt-logos');
