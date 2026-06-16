-- ============================================================
-- Migration 010: Enforce client-agreement ownership on session INSERT
-- ============================================================
-- Previously, sessions_pt_all only checked pt_id = auth.uid(), allowing a PT
-- to insert a session with any arbitrary client_id. This migration replaces
-- that policy with one that also verifies client_id is a known agreement client.

-- Drop the old permissive policy
drop policy if exists "sessions_pt_all" on sessions;

-- Re-create with a WITH CHECK clause that validates the client relationship
create policy "sessions_pt_all" on sessions
  for all
  using     (pt_id = auth.uid())
  with check (
    pt_id = auth.uid()
    and exists (
      select 1 from client_agreements ca
      where ca.pt_id = auth.uid()
        and ca.client_id = sessions.client_id
    )
  );
