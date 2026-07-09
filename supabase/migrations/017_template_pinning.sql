-- ── 017_template_pinning.sql ─────────────────────────────────────────────
-- Adds is_pinned to session_templates so PTs can pin favorite templates
-- to the top of the "My Templates" picker list instead of scrolling
-- through everything sorted by creation date.
--
-- APPLY VIA: Supabase dashboard > SQL Editor

alter table session_templates
  add column if not exists is_pinned boolean not null default false;
