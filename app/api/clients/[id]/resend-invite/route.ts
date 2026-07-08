import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidUuid }       from '@/lib/utils';

interface Params { params: Promise<{ id: string }> }

const COOLDOWN_MS = 60 * 1000; // 1 resend per client per minute

export async function POST(_req: NextRequest, { params }: Params) {
  const { id: clientId } = await params;
  if (!isValidUuid(clientId)) return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: pt } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (pt?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Verify this PT has an agreement with the client
  const { data: agreement } = await supabase
    .from('client_agreements')
    .select('id, last_invite_resent_at')
    .eq('client_id', clientId)
    .eq('pt_id', user.id)
    .single();
  if (!agreement) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  // Rate limit: no prior rate limiting existed here, letting a PT spam a
  // client's inbox with repeated calls. One resend per client per minute.
  if (agreement.last_invite_resent_at) {
    const elapsedMs = Date.now() - new Date(agreement.last_invite_resent_at).getTime();
    if (elapsedMs < COOLDOWN_MS) {
      const waitSecs = Math.ceil((COOLDOWN_MS - elapsedMs) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSecs}s before resending another invite.` },
        { status: 429 },
      );
    }
  }

  const admin = createAdminClient();
  const { data: clientProfile } = await admin.from('profiles').select('email').eq('id', clientId).single();
  if (!clientProfile?.email) return NextResponse.json({ error: 'Client email not found' }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const { error } = await admin.auth.admin.inviteUserByEmail(clientProfile.email, {
    redirectTo: `${appUrl}/auth/callback`,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin
    .from('client_agreements')
    .update({ last_invite_resent_at: new Date().toISOString() })
    .eq('id', agreement.id);

  return NextResponse.json({ ok: true });
}
