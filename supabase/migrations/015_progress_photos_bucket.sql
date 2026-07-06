-- ============================================================
-- 015_progress_photos_bucket.sql
-- Supabase Storage bucket for client progress-photo uploads
--
-- Fixes BUG-59: POST /api/portal/photos returned 500 "Bucket not
-- found" because migration 007 documented this bucket but never
-- created it (the progress_photos table itself was also missing —
-- migration 007 had never been applied at all). Both this migration
-- and 007 have been applied live against this project via
-- `supabase db query --linked --file`, and the fix is verified
-- end-to-end (client upload -> 201 -> delete -> 200).
--
-- Run in Supabase SQL editor: Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Create the bucket (public so getPublicUrl works without signed URLs)
insert into storage.buckets (id, name, public, file_size_limit)
values ('progress-photos', 'progress-photos', true, 10485760) -- 10 MB
on conflict (id) do nothing;

-- 2. Allow authenticated clients to upload/replace their own progress photos
--    Path pattern: {clientId}/{filename}
create policy "client_upload_own_progress_photo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "client_update_own_progress_photo" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "client_delete_own_progress_photo" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Public read (photos render in the client portal / PT view without signed URLs)
create policy "public_read_progress_photos" on storage.objects
  for select
  using (bucket_id = 'progress-photos');
