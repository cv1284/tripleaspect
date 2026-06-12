/**
 * Cleanup + bug resolution for the 2026-06-12 nightly audit run.
 * Run: npx tsx --env-file=.env.local scripts/audit-cleanup-2026-06-12.ts
 */
import { createClient } from '@supabase/supabase-js';

const EXERCISE_ID  = '7488d3e6-c411-497b-9397-0dcb46aaa8fe'; // "Audit Happy Exercise" test row
const BUG_REPORT_ID = 'ff2720e7-e282-4fa1-a2fc-0265fa33b668'; // BUG-33 report

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { error: exErr } = await admin.from('exercises').delete().eq('id', EXERCISE_ID);
  console.log('Deleted test exercise:', exErr ? exErr.message : 'ok');

  const { error: bugErr } = await admin
    .from('bug_reports')
    .update({
      status: 'resolved',
      resolved_note: 'Fixed in nightly audit 2026-06-12: added typeof string checks before .trim() in app/api/exercises/route.ts, app/api/programmes/route.ts, and app/api/templates/route.ts. Non-string description/coaching_cues/default_video_url/title/notes now return a clean 400 instead of a raw 500.',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', BUG_REPORT_ID);
  console.log('Resolved bug report:', bugErr ? bugErr.message : 'ok');
}

main();
