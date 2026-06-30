-- ── 012_client_goals.sql ──────────────────────────────────────────────────
-- Adds a lightweight goal field to client_agreements so a PT can set a
-- client's current goal (with an optional target date), visible to the
-- client on their portal home page.
--
-- APPLY VIA: Supabase dashboard > SQL Editor (Docker not available in this env)

alter table client_agreements
  add column if not exists goal_text        text,
  add column if not exists goal_target_date date;
