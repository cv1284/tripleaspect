-- ── 018_client_milestones.sql ────────────────────────────────────────────
-- Adds a milestones field to client_agreements so PTs can track multiple
-- named checkpoints toward a client's goal (beyond the single goal_text/
-- goal_progress pair added in 012/013). Stored as a JSONB array of
-- { id, text, target_date, progress } objects; validated at the API layer.
--
-- APPLY VIA: Supabase dashboard > SQL Editor

alter table client_agreements
  add column if not exists milestones jsonb not null default '[]'::jsonb;
