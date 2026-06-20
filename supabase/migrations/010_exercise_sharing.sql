-- ── 010_exercise_sharing.sql ─────────────────────────────────────────────────
-- Allows PTs to share their custom exercises with all other PTs.
-- A shared custom exercise becomes readable by any authenticated user,
-- just like the base library exercises (is_custom = false).

-- 1. Add column
alter table exercises
  add column if not exists is_shared boolean not null default false;

-- 2. Index for quick reads of the shared pool
create index if not exists idx_exercises_shared on exercises(is_shared) where is_shared = true;

-- 3. Update the public-read policy so shared custom exercises are also world-readable
drop policy if exists "exercises_public_read" on exercises;
create policy "exercises_public_read" on exercises
  for select using (is_custom = false or is_shared = true);

-- 4. The existing exercises_pt_write policy already covers UPDATE by the owning PT,
--    so toggling is_shared is automatically allowed with no extra change needed.
