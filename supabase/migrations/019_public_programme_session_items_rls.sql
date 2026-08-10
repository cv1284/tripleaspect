-- Migration 019: fix missing RLS policy on programme_session_items
--
-- programme_weeks and programme_sessions both got an "accesses own" +
-- "reads public" pair of policies in 006_programmes.sql, but
-- programme_session_items only got the "accesses own" one. That silently
-- zeroed out the `items` relation for any PT reading another PT's public
-- programme (e.g. via /api/programmes/[id]/duplicate) — the row-level
-- security join returned no items even though the parent programme,
-- week, and session were all correctly visible.

CREATE POLICY "PT reads public programme_session_items" ON programme_session_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM programme_sessions ps
      JOIN programme_weeks pw ON pw.id = ps.week_id
      JOIN programmes p ON p.id = pw.programme_id
      WHERE ps.id = programme_session_items.programme_session_id AND p.is_public = true
    )
  );
