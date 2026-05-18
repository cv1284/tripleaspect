import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code       = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type       = searchParams.get('type') as EmailOtpType | null;
  const next       = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      // Invite links: user is now signed in but needs to set a password
      const destination = type === 'invite' ? '/auth/reset' : next;
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // Fall back to login on any failure
  return NextResponse.redirect(`${origin}/login`);
}
