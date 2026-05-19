-- ============================================================
-- 006_profile_logo_url.sql
-- Separates personal avatar from brand logo on PT profiles.
--   avatar_url  — profile photo / face (shown in nav)
--   logo_url    — business brand mark (shown on public templates)
-- Run in Supabase SQL editor: Dashboard → SQL Editor → New query
-- ============================================================

alter table profiles
  add column if not exists logo_url text;
