/**
 * Creates two test accounts for local testing:
 *   PT:     test.pt@brigid.local   / TestPass123!
 *   Client: test.client@brigid.local / TestPass123!
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-test-accounts.ts
 */
import { createClient } from '@supabase/supabase-js';

const TEST_PASSWORD = 'TestPass123!';

const PT_EMAIL     = 'test.pt@brigid.local';
const PT_NAME      = 'Test PT';
const CLIENT_EMAIL = 'test.client@brigid.local';
const CLIENT_NAME  = 'Test Client';

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // ── 1. Create PT user ─────────────────────────────────────────────────────
  console.log('Creating PT user…');
  const { data: ptData, error: ptErr } = await admin.auth.admin.createUser({
    email:          PT_EMAIL,
    password:       TEST_PASSWORD,
    email_confirm:  true,
    user_metadata:  { full_name: PT_NAME },
  });

  let ptId: string;
  if (ptErr) {
    if (ptErr.message.toLowerCase().includes('already been registered') ||
        ptErr.message.toLowerCase().includes('already exists')) {
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = users.find(u => u.email === PT_EMAIL);
      if (!existing) { console.error('PT user error:', ptErr.message); process.exit(1); }
      ptId = existing.id;
      console.log('  PT already exists, reusing:', ptId);
    } else {
      console.error('PT user error:', ptErr.message);
      process.exit(1);
    }
  } else {
    ptId = ptData.user.id;
    console.log('  PT created:', ptId);
  }

  // Upsert PT profile with role='pt'
  const { error: ptProfileErr } = await admin.from('profiles').upsert(
    { id: ptId, email: PT_EMAIL, full_name: PT_NAME, role: 'pt' },
    { onConflict: 'id' },
  );
  if (ptProfileErr) { console.error('PT profile error:', ptProfileErr.message); process.exit(1); }
  console.log('  PT profile set to role=pt');

  // ── 2. Create Client user ─────────────────────────────────────────────────
  console.log('Creating Client user…');
  const { data: clientData, error: clientErr } = await admin.auth.admin.createUser({
    email:          CLIENT_EMAIL,
    password:       TEST_PASSWORD,
    email_confirm:  true,
    user_metadata:  { full_name: CLIENT_NAME },
  });

  let clientId: string;
  if (clientErr) {
    if (clientErr.message.toLowerCase().includes('already been registered') ||
        clientErr.message.toLowerCase().includes('already exists')) {
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = users.find(u => u.email === CLIENT_EMAIL);
      if (!existing) { console.error('Client user error:', clientErr.message); process.exit(1); }
      clientId = existing.id;
      console.log('  Client already exists, reusing:', clientId);
    } else {
      console.error('Client user error:', clientErr.message);
      process.exit(1);
    }
  } else {
    clientId = clientData.user.id;
    console.log('  Client created:', clientId);
  }

  // Upsert client profile
  const { error: clientProfileErr } = await admin.from('profiles').upsert(
    { id: clientId, email: CLIENT_EMAIL, full_name: CLIENT_NAME, role: 'client' },
    { onConflict: 'id' },
  );
  if (clientProfileErr) { console.error('Client profile error:', clientProfileErr.message); process.exit(1); }
  console.log('  Client profile created');

  // ── 3. Link via client_agreement ─────────────────────────────────────────
  console.log('Creating agreement…');
  const today = new Date().toISOString().split('T')[0];
  const renewal = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { error: agErr } = await admin.from('client_agreements').upsert(
    {
      client_id:            clientId,
      pt_id:                ptId,
      status:               'active',
      agreement_model:      'subscription',
      start_date:           today,
      renewal_date:         renewal,
      program_length_weeks: 12,
      manual_price_numeric: 150.00,
      manual_currency:      'GBP',
      billing_notes:        'Test account — monthly subscription',
    },
    { onConflict: 'client_id,pt_id' },
  );
  if (agErr) { console.error('Agreement error:', agErr.message); process.exit(1); }
  console.log('  Agreement created (active, 90-day renewal)');

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n✓ Test accounts ready');
  console.log(`  PT:     ${PT_EMAIL}     / ${TEST_PASSWORD}`);
  console.log(`  Client: ${CLIENT_EMAIL} / ${TEST_PASSWORD}`);
  console.log(`  Client portal: http://localhost:3000/portal/${clientId}`);
}

main();
