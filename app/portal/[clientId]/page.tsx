import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { Session, ClientAgreement, Profile, SessionCategory } from '@/types/database';
import SessionView from '@/components/client/SessionView';
import PortalBanners from '@/components/client/PortalBanners';
import { CATEGORY_CONFIG } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function ClientPortalPage({ params }: Props) {
  const { clientId } = await params;
  const supabase     = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: viewer } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isOwnPortal = user.id === clientId;
  const isPT        = viewer?.role === 'pt';

  if (!isOwnPortal && !isPT) redirect('/login');

  // Use admin client to fetch the client profile — the pt_reads_clients RLS policy
  // can silently block profile reads for invited-but-unconfirmed clients (same quirk
  // handled by the admin fallback in the PT clients page).
  // PTs are gated by the agreement check below; clients can only see their own portal.
  const admin = createAdminClient();

  if (isPT && !isOwnPortal) {
    const { data: agreement } = await supabase
      .from('client_agreements')
      .select('id')
      .eq('pt_id', user.id)
      .eq('client_id', clientId)
      .single();
    if (!agreement) redirect('/login');
  }

  const { data: client } = await admin
    .from('profiles')
    .select('*')
    .eq('id', clientId)
    .single();

  if (!client) notFound();

  const { data: agreement } = await supabase
    .from('client_agreements')
    .select('*, pt:profiles!client_agreements_pt_id_fkey(email, full_name)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const today = format(new Date(), 'yyyy-MM-dd');

  // Today's session only
  const { data: todaySessions } = await supabase
    .from('sessions')
    .select(`*, session_items(*, exercise:exercises(*))`)
    .eq('client_id', clientId)
    .eq('scheduled_date', today)
    .order('created_at', { ascending: false })
    .limit(1);

  // If no session today, look ahead for the next upcoming one (for the rest-day hint)
  const { data: upcomingSessions } = !todaySessions?.length
    ? await supabase
        .from('sessions')
        .select('id, title, scheduled_date, category')
        .eq('client_id', clientId)
        .gt('scheduled_date', today)
        .order('scheduled_date', { ascending: true })
        .limit(1)
    : { data: null };

  const session    = todaySessions?.[0] ?? null;
  const nextUp     = upcomingSessions?.[0] ?? null;
  const ptEmail    = (agreement as unknown as { pt?: { email: string } })?.pt?.email;

  if (!agreement) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-2xl">◎</p>
          <p className="text-slate-400 font-medium">No active agreement found.</p>
          <p className="text-slate-600 text-sm font-mono">Contact your coach to get started.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    const nextUpCfg = nextUp ? CATEGORY_CONFIG[nextUp.category as SessionCategory] : null;
    const nextUpDate = nextUp?.scheduled_date
      ? format(parseISO(nextUp.scheduled_date), 'EEEE d MMMM')
      : null;

    return (
      <div className="min-h-screen bg-surface-0">
        <header className="sticky top-0 bg-surface-0/90 backdrop-blur-md border-b border-surface-border z-20">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-slate-300 font-semibold font-mono text-sm">brigid.pro</span>
            <span className="text-xs font-mono text-slate-600">{client.full_name?.split(' ')[0]}</span>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6 pb-24">
          <PortalBanners agreement={agreement as ClientAgreement} ptEmail={ptEmail} />
          <div className="py-16 text-center space-y-3">
            <p className="text-4xl">◈</p>
            <h1 className="text-xl font-semibold text-slate-200">Rest Day</h1>
            <p className="text-slate-500 font-mono text-sm">
              Rest well, {client.full_name?.split(' ')[0] ?? 'athlete'}.
            </p>
            <p className="text-slate-600 text-xs font-mono">Recovery is part of the programme.</p>

            {/* Next upcoming session hint */}
            {nextUp && nextUpDate && nextUpCfg && (
              <div className="mt-6 mx-auto max-w-xs px-4 py-3 rounded-xl bg-surface-2 border border-surface-border text-left space-y-1">
                <p className="text-2xs font-mono text-slate-600 uppercase tracking-widest">Next up</p>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${nextUpCfg.color}`}>{nextUpCfg.icon}</span>
                  <p className="text-sm font-medium text-slate-200 truncate">{nextUp.title}</p>
                </div>
                <p className="text-xs font-mono text-slate-500">{nextUpDate}</p>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <SessionView
      session={session as Session}
      agreement={agreement as ClientAgreement}
      client={client as Profile}
      ptEmail={ptEmail}
    />
  );
}
