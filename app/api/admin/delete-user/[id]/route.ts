import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface Params { params: Promise<{ id: string }> }

function isAdmin(email: string | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  return !!adminEmail && email === adminEmail;
}

/**
 * GET /api/admin/delete-user/[id]
 * Export any user's full data as JSON (admin only).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id: userId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .eq('id', userId)
    .single();

  const { data: agreements } = await admin
    .from('client_agreements')
    .select('*')
    .or(`client_id.eq.${userId},pt_id.eq.${userId}`);

  const { data: sessions } = await admin
    .from('sessions')
    .select(`
      id, title, category, scheduled_date, completed_at, notes, created_at,
      session_items (
        id, sort_order, prescribed_metrics, custom_coaching_cues, custom_youtube_url,
        exercise:exercises ( id, name, category )
      )
    `)
    .or(`client_id.eq.${userId},pt_id.eq.${userId}`)
    .order('scheduled_date', { ascending: false });

  const payload = {
    export_metadata: {
      exported_at:        new Date().toISOString(),
      exported_by_admin:  user.email,
      brigid_pro_version: '1.0',
    },
    profile,
    agreements: agreements ?? [],
    sessions:   sessions   ?? [],
  };

  const filename = `admin_export_${(profile?.email ?? userId)
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type':        'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * DELETE /api/admin/delete-user/[id]
 * Permanently deletes any auth user (admin only).
 * Cascades via FK: auth.users → profiles → sessions → session_items → agreements
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: userId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Prevent self-deletion
  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
