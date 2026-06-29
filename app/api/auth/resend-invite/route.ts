import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readJsonBody } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { email } = body as { email?: any };
  if (!email || typeof email !== 'string') return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

  const admin  = createAdminClient();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Only resend to emails that exist in our profiles table.
  // Return the same generic success response for unknown emails to avoid user enumeration.
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!targetProfile) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/auth/callback`,
  });

  if (error) {
    // User already confirmed — they should just sign in
    if (error.message.toLowerCase().includes('already been registered') ||
        error.message.toLowerCase().includes('already exists')) {
      return NextResponse.json(
        { error: 'This account is already active. Try signing in, or use "Forgot password" to reset your password.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
