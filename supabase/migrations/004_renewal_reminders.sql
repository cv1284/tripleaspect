-- Migration 004: renewal reminder tracking column
-- Prevents double-firing emails across the same renewal cycle.

ALTER TABLE client_agreements
  ADD COLUMN IF NOT EXISTS renewal_reminder_sent_at TIMESTAMPTZ;
