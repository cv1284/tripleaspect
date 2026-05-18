import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect }          from 'next/navigation';
import AdminClient           from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user.email !== adminEmail) redirect('/');

  const admin = createAdminClient();

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, full_name, role, created_at, free_client_quota')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <p className="text-red-400 font-mono text-sm">{error.message}</p>
      </div>
    );
  }

  // Count agreements per PT for quota display
  const ptIds = (profiles ?? []).filter(p => p.role === 'pt').map(p => p.id);
  const { data: agreements } = ptIds.length
    ? await admin.from('client_agreements').select('pt_id').in('pt_id', ptIds)
    : { data: [] };

  const clientCountByPt: Record<string, number> = {};
  for (const a of agreements ?? []) {
    clientCountByPt[a.pt_id] = (clientCountByPt[a.pt_id] ?? 0) + 1;
  }

  const enriched = (profiles ?? []).map(p => ({
    ...p,
    client_count: clientCountByPt[p.id] ?? 0,
  }));

  return <AdminClient profiles={enriched} currentUserId={user.id} />;
}
