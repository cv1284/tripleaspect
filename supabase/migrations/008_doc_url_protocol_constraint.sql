-- ============================================================
-- Migration 008: Add protocol constraints to doc storage URLs
--
-- Prevents javascript:/data:/vbscript: URIs from being stored
-- in client agreement doc URL fields. Defence-in-depth guard
-- that enforces http/https at the DB layer regardless of how
-- the update arrives (API route, direct Supabase REST, etc.).
-- ============================================================

ALTER TABLE client_agreements
  ADD CONSTRAINT chk_parq_url_protocol
    CHECK (parq_storage_url IS NULL
      OR parq_storage_url LIKE 'https://%'
      OR parq_storage_url LIKE 'http://%'),
  ADD CONSTRAINT chk_waiver_url_protocol
    CHECK (waiver_storage_url IS NULL
      OR waiver_storage_url LIKE 'https://%'
      OR waiver_storage_url LIKE 'http://%'),
  ADD CONSTRAINT chk_consent_url_protocol
    CHECK (consent_storage_url IS NULL
      OR consent_storage_url LIKE 'https://%'
      OR consent_storage_url LIKE 'http://%');
