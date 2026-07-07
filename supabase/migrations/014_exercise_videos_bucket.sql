-- ============================================================
-- 014_exercise_videos_bucket.sql
-- Supabase Storage bucket for PT-uploaded exercise demo videos
-- (backlog: "Video upload to Supabase Storage" — alternative to
-- pasting a YouTube URL)
--
-- Run in Supabase SQL editor: Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Create the bucket (public so videos can be embedded in the client portal)
insert into storage.buckets (id, name, public, file_size_limit)
values ('exercise-videos', 'exercise-videos', true, 26214400) -- 25 MB
on conflict (id) do nothing;

-- 2. Allow authenticated PTs to upload/replace their own exercise videos
--    Path pattern: {ptId}/{filename}
create policy "pt_upload_own_exercise_video" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'exercise-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "pt_update_own_exercise_video" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'exercise-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "pt_delete_own_exercise_video" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'exercise-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Public read (videos render in the client portal without auth)
create policy "public_read_exercise_videos" on storage.objects
  for select
  using (bucket_id = 'exercise-videos');
