/**
 * Deletes the ephemeral PT accounts created during the 2026-06-02 automated audit run.
 * These were created because Turnstile is not enforced in the dev environment.
 *
 * Run: npx tsx --env-file=.env.local scripts/cleanup-audit-accounts.ts
 */
import { createClient } from '@supabase/supabase-js';

const AUDIT_EMAILS = [
  'test@example.com',
  'edge@example.com',
  'big@example.com',
  'uni@example.com',
  'xss@example.com',
  'html@example.com',
  'space@test.com',
];

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) { console.error('List error:', listErr.message); process.exit(1); }

  const targets = users.filter(u => u.email && AUDIT_EMAILS.includes(u.email));
  console.log(`Found ${targets.length} audit account(s) to delete.`);

  for (const user of targets) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`  ✗ ${user.email}: ${error.message}`);
    } else {
      console.log(`  ✓ Deleted ${user.email} (${user.id})`);
    }
  }

  console.log('\nCleanup complete.');
}

main();
