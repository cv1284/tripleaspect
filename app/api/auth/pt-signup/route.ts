import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const { full_name, email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || null },
  });

  if (createErr) {
    const msg = createErr.message.toLowerCase().includes('already')
      ? 'An account with this email already exists.'
      : createErr.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await admin.from('profiles').upsert(
    { id: data.user.id, email, full_name: full_name || null, role: 'pt', free_client_quota: 3 },
    { onConflict: 'id' },
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
