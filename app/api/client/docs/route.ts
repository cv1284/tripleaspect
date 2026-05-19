import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/client/docs
 *
 * Allows a client to paste their own document URLs onto their agreement.
 * Only updates storage URL fields — the PT still controls the _signed booleans.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Only allow URL fields — never let the client flip the signed booleans
  const allowed = ['parq_storage_url', 'waiver_storage_url', 'consent_storage_url'] as const;
  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) => (allowed as readonly string[]).includes(k)),
  );

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  // Use admin client for all DB ops — clients have SELECT-only RLS on client_agreements
  // and the single-object accept header conflicts with RLS filters.
  // Auth is validated above via JWT; ownership is enforced by filtering on user.id.
  const admin = createAdminClient();

  const { data: agreements, error: selErr } = await admin
    .from('client_agreements')
    .select('id')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  const agreement = agreements?.[0] ?? null;
  if (!agreement) {
    return NextResponse.json({ error: 'No agreement found' }, { status: 404 });
  }

  const { error: updErr } = await admin
    .from('client_agreements')
    .update(patch)
    .eq('id', agreement.id)
    .eq('client_id', user.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
