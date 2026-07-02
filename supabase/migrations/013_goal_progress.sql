-- ── 013_goal_progress.sql ─────────────────────────────────────────────────
-- Adds a goal_progress field to client_agreements so PTs can track how close
-- a client is to achieving their goal (0–100%). Nullable — omitted until the
-- PT explicitly sets a percentage.
--
-- APPLY VIA: Supabase dashboard > SQL Editor

alter table client_agreements
  add column if not exists goal_progress smallint
    check (goal_progress >= 0 and goal_progress <= 100);
