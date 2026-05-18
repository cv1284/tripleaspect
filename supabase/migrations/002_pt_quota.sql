-- ============================================================
-- 002 — Add free client quota to PT profiles
-- ============================================================

alter table profiles
  add column free_client_quota integer not null default 3;
