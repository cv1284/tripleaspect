-- ============================================================
-- Brigid.pro — Inactivity Auto-Flag Workflow
-- ============================================================
-- Adds 6-month inactivity detection to client_agreements:
--   1. last_active_at       — denormalised from sessions.completed_at via trigger
--   2. inactivity_flagged_at — set by nightly cron sweep
--   3. inactivity_notified_at — set when email is dispatched
--   4. inactivity_keep_until — set when client responds "keep for 6 months"

alter table client_agreements
  add column last_active_at         timestamptz,
  add column inactivity_flagged_at  timestamptz,
  add column inactivity_notified_at timestamptz,
  add column inactivity_keep_until  timestamptz;

-- Fast sweep: only un-flagged inactive rows with stale activity
create index idx_agreements_inactivity
  on client_agreements(last_active_at, status)
  where inactivity_flagged_at is null;

-- ─── Trigger: keep last_active_at current ─────────────────
-- Fires whenever a session is completed (completed_at set).
-- Also clears any pending inactivity flag so the client isn't
-- flagged again immediately after resuming.
create or replace function fn_update_last_active_at()
returns trigger language plpgsql as $$
begin
  if new.completed_at is not null and (
    tg_op = 'INSERT' or old.completed_at is distinct from new.completed_at
  ) then
    update client_agreements
    set
      last_active_at        = new.completed_at,
      inactivity_flagged_at = null,
      inactivity_notified_at = null
    where client_id = new.client_id
      and pt_id     = new.pt_id;
  end if;
  return new;
end;
$$;

create trigger trg_sessions_last_active
  after insert or update of completed_at on sessions
  for each row execute function fn_update_last_active_at();

-- ─── Function: nightly inactivity sweep ───────────────────
-- Called by the Vercel Cron route via supabase.rpc().
-- Flags agreements that are inactive, have had no session
-- completion in 6+ months, and haven't been flagged yet.
-- Returns the flagged rows so the caller can dispatch emails.
create or replace function fn_flag_inactive_agreements()
returns table(agreement_id uuid, client_id uuid, pt_id uuid)
language plpgsql as $$
begin
  return query
  update client_agreements
  set inactivity_flagged_at = now()
  where status = 'inactive'
    and (
      last_active_at < now() - interval '6 months'
      or last_active_at is null
    )
    and inactivity_flagged_at is null
    and (inactivity_keep_until is null or inactivity_keep_until < now())
    and deletion_scheduled_at is null
  returning
    id          as agreement_id,
    client_agreements.client_id,
    client_agreements.pt_id;
end;
$$;
