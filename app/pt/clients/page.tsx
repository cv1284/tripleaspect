import { createClient } from '@/lib/supabase/server';
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

  if (profile?.role !== 'pt') redirect('/portal');

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

  // Build ClientRow array
  const clients: ClientRow[] = (agreements ?? []).map(agreement => {
    const client = agreement.client as ClientRow;
    return {
      ...client,
      agreement,
      sessions_this_week:  sessionCountMap[agreement.client_id] ?? 0,
      days_until_renewal:  daysUntilRenewal(agreement.renewal_date),
      onboarding_complete: isOnboardingComplete(agreement),
    };
  });

  return <ClientsPageClient clients={clients} ptId={user.id} />;
}
