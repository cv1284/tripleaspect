import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect }          from 'next/navigation';
import AdminClient           from './AdminClient';
import BugReportsPanel       from '@/components/admin/BugReportsPanel';
import { BugReport }         from '@/types/database';

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

  // Fetch bug reports for the panel
  const { data: bugReports } = await admin
    .from('bug_reports')
    .select(`
      id, ref, user_id, url, page_title, notes, screenshot_url,
      user_agent, report_type, status, resolved_note, resolved_at, created_at,
      user:profiles ( full_name, email )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div>
      <BugReportsPanel initialReports={(bugReports ?? []) as unknown as BugReport[]} />
      <div className="border-t border-surface-border" />
      <AdminClient profiles={enriched} currentUserId={user.id} />
    </div>
  );
}
