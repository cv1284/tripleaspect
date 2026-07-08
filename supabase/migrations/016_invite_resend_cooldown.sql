-- ── 016_invite_resend_cooldown.sql ────────────────────────────────────────
-- Adds a last_invite_resent_at field to client_agreements so
-- POST /api/clients/[id]/resend-invite can enforce a cooldown between
-- resends — previously unbounded, letting a PT spam a client's inbox with
-- no rate limit anywhere in this route (audit finding, 2026-07-08).
--
-- APPLY VIA: Supabase dashboard > SQL Editor

alter table client_agreements
  add column if not exists last_invite_resent_at timestamptz;
