import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface Params { params: Promise<{ id: string }> }

/**
 * DELETE /api/clients/[id]/gdpr-delete
 *
 * Permanently deletes a client's auth user, which cascades via FK:
 *   auth.users → profiles → sessions → session_items
 *                          → client_agreements
 *
 * Only the owning PT can trigger this.
 * The PT should have already downloaded the client's data export before calling this.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: clientId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify the PT owns an agreement with this client before deleting
  const { data: agreement } = await supabase
    .from('client_agreements')
    .select('id')
    .eq('pt_id', user.id)
    .eq('client_id', clientId)
    .single();

  if (!agreement) {
    return NextResponse.json({ error: 'Client not found or not authorised' }, { status: 404 });
  }

  // Use admin client to delete the auth user — cascades all data
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(clientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
