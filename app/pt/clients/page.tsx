import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import { isOnboardingComplete } from '@/types/database';
import { daysUntilRenewal } from '@/lib/utils';
import { ClientRow } from '@/types/database';
import ClientsPageClient from './ClientsPageClient';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify PT role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'pt') redirect(`/portal/${user.id}`);

  // Fetch all clients + agreements for this PT
  const { data: agreements, error } = await supabase
    .from('client_agreements')
    .select(`
      *,
      client:profiles!client_agreements_client_id_fkey (
        id, email, full_name, role, avatar_url, created_at, updated_at
      )
    `)
    .eq('pt_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch clients:', error);
    return <div className="p-8 text-red-400 font-mono text-sm">{error.message}</div>;
  }

  // Fetch this-week session counts per client
  const clientIds = (agreements ?? []).map(a => a.client_id);
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);

  const { data: weekSessions } = await supabase
    .from('sessions')
    .select('client_id')
    .eq('pt_id', user.id)
    .in('client_id', clientIds)
    .gte('scheduled_date', startOfWeek.toISOString().split('T')[0]);

  const sessionCountMap = (weekSessions ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.client_id] = (acc[s.client_id] ?? 0) + 1;
    return acc;
  }, {});

  // Fetch next upcoming (incomplete) session date per client
  const today = new Date().toISOString().split('T')[0];
  const { data: upcomingSessions } = await supabase
    .from('sessions')
    .select('client_id, scheduled_date')
    .eq('pt_id', user.id)
    .in('client_id', clientIds)
    .gte('scheduled_date', today)
    .is('completed_at', null)
    .order('scheduled_date', { ascending: true });

  const nextSessionMap = (upcomingSessions ?? []).reduce<Record<string, string>>((acc, s) => {
    if (!acc[s.client_id] && s.scheduled_date) acc[s.client_id] = s.scheduled_date;
    return acc;
  }, {});

  // If any profiles came back null (RLS policy quirk in Supabase), fetch them via admin
  const nullClientIds = (agreements ?? [])
    .filter(a => a.client == null)
    .map(a => a.client_id);

  let adminProfiles: Record<string, Record<string, unknown>> = {};
  if (nullClientIds.length > 0) {
    const admin = createAdminClient();
    const { data: fallbackProfiles } = await admin
      .from('profiles')
      .select('id, email, full_name, role, avatar_url, created_at, updated_at')
      .in('id', nullClientIds);
    for (const p of fallbackProfiles ?? []) {
      adminProfiles[p.id] = p as Record<string, unknown>;
    }
  }

  // Build ClientRow array — guard against null profile joins (invited but not yet set up)
  const clients: ClientRow[] = (agreements ?? [])
    .filter(agreement => agreement.client != null || adminProfiles[agreement.client_id] != null)
    .map(agreement => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (agreement.client ?? adminProfiles[agreement.client_id]) as any;
      return {
        id:          p.id          ?? agreement.client_id,
        email:       p.email       ?? '',
        full_name:   p.full_name   ?? null,
        role:        p.role        ?? 'client',
        avatar_url:  p.avatar_url  ?? null,
        created_at:  p.created_at  ?? new Date().toISOString(),
        updated_at:  p.updated_at  ?? new Date().toISOString(),
        agreement,
        sessions_this_week:  sessionCountMap[agreement.client_id] ?? 0,
        days_until_renewal:  daysUntilRenewal(agreement.renewal_date),
        onboarding_complete: isOnboardingComplete(agreement),
        next_session_date:   nextSessionMap[agreement.client_id] ?? null,
      } as ClientRow;
    });

  return <ClientsPageClient clients={clients} ptId={user.id} />;
}
