-- ============================================================
-- Brigid.pro — Deletion Scheduling
-- ============================================================
-- Adds deferred account deletion support to client_agreements.
-- When a PT schedules an account for deletion, deletion_scheduled_at
-- is set to now() + 14 days.  The PT dashboard surfaces overdue
-- accounts so the PT can complete the deletion manually.

alter table client_agreements
  add column deletion_scheduled_at  timestamptz,
  add column deletion_reason        text;

-- Efficient lookup for dashboard overdue checks
create index idx_agreements_deletion_scheduled
  on client_agreements(deletion_scheduled_at)
  where deletion_scheduled_at is not null;
