/**
 * Cleanup + bug resolution for the 2026-06-14 nightly audit run.
 * Run: npx tsx --env-file=.env.local scripts/audit-cleanup-2026-06-14.ts
 */
import { createClient } from '@supabase/supabase-js';

const BUG_REPORT_ID = '6be96ab2-ed74-4da7-ba86-b709b483cd51'; // BUG-35 report (tracker ref #32)
const TEST_CHECKIN_ID = 'd9cd2a4d-7462-49dc-8fb9-8d1f0efcad1a'; // Suite A sanity check-in created during testing

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { error: bugErr } = await admin
    .from('bug_reports')
    .update({
      status: 'resolved',
      resolved_note: 'Fixed in nightly audit 2026-06-14: added isValidUuid() guards to app/api/portal/checkin/route.ts (POST session_id, GET sessionId) — a malformed-id session_id/sessionId now returns a clean 400 "must be a valid id" instead of a raw Postgrest "invalid input syntax for type uuid" error. Same root cause class as BUG-34.',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', BUG_REPORT_ID);
  console.log('Resolved bug report:', bugErr ? bugErr.message : 'ok');

  const { error: checkinErr } = await admin
    .from('wellbeing_checkins')
    .delete()
    .eq('id', TEST_CHECKIN_ID);
  console.log('Deleted test check-in:', checkinErr ? checkinErr.message : 'ok');
}

main();
