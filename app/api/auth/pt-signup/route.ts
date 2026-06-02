import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const { full_name, email, password, cf_token } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  if (typeof password !== 'string' || password.trim().length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 non-whitespace characters.' }, { status: 400 });
  }
  if (full_name && typeof full_name === 'string' && full_name.length > 255) {
    return NextResponse.json({ error: 'Full name must be 255 characters or fewer.' }, { status: 400 });
  }

  // Cloudflare Turnstile verification
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    if (!cf_token) {
      return NextResponse.json({ error: 'Human verification required.' }, { status: 400 });
    }
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        secret:   turnstileSecret,
        response: cf_token,
        remoteip: req.headers.get('x-forwarded-for') ?? undefined,
      }),
    });
    const { success } = await verifyRes.json() as { success: boolean };
    if (!success) {
      return NextResponse.json({ error: 'Human verification failed. Please try again.' }, { status: 403 });
    }
  }

  const admin = createAdminClient();

  const { data, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,  // requires email verification click before login
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
