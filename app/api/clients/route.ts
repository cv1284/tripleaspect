import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Verify caller is an authenticated PT
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ptProfile } = await supabase
    .from('profiles').select('role, free_client_quota').eq('id', user.id).single();
  if (ptProfile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const {
    full_name, email,
    agreement_model, start_date, renewal_date, program_length_weeks,
    manual_price_numeric, manual_currency,
  } = await req.json();

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const admin    = createAdminClient();
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  let   clientId = '';

  // Enforce free client quota
  const { count: clientCount } = await admin
    .from('client_agreements')
    .select('id', { count: 'exact', head: true })
    .eq('pt_id', user.id);

  const quota = ptProfile?.free_client_quota ?? 3;
  if (typeof clientCount === 'number' && clientCount >= quota) {
    return NextResponse.json(
      { error: `You've reached your limit of ${quota} client${quota !== 1 ? 's' : ''}. Contact the platform owner to increase your quota.` },
      { status: 403 },
    );
  }

  // Invite the user — creates auth row + sends invite email
  const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data:       { full_name },
    redirectTo: `${appUrl}/auth/callback`,
  });

  if (inviteErr) {
    // User already exists — look them up
    if (inviteErr.message.toLowerCase().includes('already been registered') ||
        inviteErr.message.toLowerCase().includes('already exists')) {
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = users.find(u => u.email === email);
      if (!existing) return NextResponse.json({ error: inviteErr.message }, { status: 400 });
      clientId = existing.id;
    } else {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 });
    }
  } else {
    clientId = invite.user.id;
  }

  // Upsert profile (trigger may have already created it with just email)
  await admin.from('profiles').upsert(
    { id: clientId, email, full_name: full_name || null, role: 'client' },
    { onConflict: 'id' },
  );

  // Create agreement — upsert in case re-adding an existing client
  const { data: agreement, error: agErr } = await admin
    .from('client_agreements')
    .upsert({
      client_id:            clientId,
      pt_id:                user.id,
      status:               'active',
      agreement_model:      agreement_model      ?? 'subscription',
      start_date:           start_date           ?? new Date().toISOString().split('T')[0],
      renewal_date:         renewal_date         || null,
      program_length_weeks: program_length_weeks ? parseInt(program_length_weeks) : null,
      manual_price_numeric: manual_price_numeric ? parseFloat(manual_price_numeric) : null,
      manual_currency:      manual_currency      ?? 'GBP',
    }, { onConflict: 'client_id,pt_id' })
    .select()
    .single();

  if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 });

  return NextResponse.json({ client_id: clientId, agreement }, { status: 201 });
}
