import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readJsonBody }      from '@/lib/utils';

/**
 * POST /api/admin/set-role
 * Body: { userId: string, role: 'pt' | 'client' }
 *
 * Only callable by the ADMIN_EMAIL account.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { userId, role } = body as { userId?: any; role?: any };

  if (!userId || !['pt', 'client'].includes(role)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Prevent revoking your own admin account
  if (userId === user.id && role === 'client') {
    return NextResponse.json({ error: 'Cannot demote your own account' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
