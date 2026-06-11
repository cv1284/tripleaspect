import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readJsonBody }      from '@/lib/utils';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ptId: string }> },
) {
  const supabase   = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { ptId } = await params;
  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { free_client_quota } = body as { free_client_quota?: unknown };

  if (typeof free_client_quota !== 'number' || free_client_quota < 0) {
    return NextResponse.json({ error: 'Invalid quota value.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ free_client_quota })
    .eq('id', ptId)
    .eq('role', 'pt');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
