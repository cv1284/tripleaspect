/**
 * Cleanup + bug resolution for the 2026-06-13 nightly audit run.
 * Run: npx tsx --env-file=.env.local scripts/audit-cleanup-2026-06-13.ts
 */
import { createClient } from '@supabase/supabase-js';

const BUG_REPORT_ID = '1542d247-579f-4243-8d8e-c9a552ade2de'; // BUG-34 report (tracker ref #31)

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
      resolved_note: 'Fixed in nightly audit 2026-06-13: added isValidUuid() guard (lib/utils.ts) to app/api/agreements/[id]/route.ts (GET/PATCH/DELETE), app/api/programmes/[id]/route.ts (GET/PATCH/DELETE), and app/api/templates/[id]/route.ts (PATCH) — malformed-UUID ids now return a clean 404 instead of a raw Postgrest "invalid input syntax for type uuid" error. Also replaced leaked "Cannot coerce the result to a single JSON object" (PGRST116) messages on GET /api/agreements/[id] and GET /api/programmes/[id] with clean "Agreement/Programme not found" 404s.',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', BUG_REPORT_ID);
  console.log('Resolved bug report:', bugErr ? bugErr.message : 'ok');
}

main();
