-- ── 011_session_client_notes.sql ─────────────────────────────────────────────
-- Adds a client_notes column to sessions so clients can leave a completion note
-- when they mark a session done via the portal.
--
-- APPLY VIA: Supabase dashboard > SQL Editor (Docker not available in this env)

alter table sessions
  add column if not exists client_notes text;
