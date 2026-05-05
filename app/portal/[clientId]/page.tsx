import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { Session, ClientAgreement, Profile } from '@/types/database';
import SessionView from '@/components/client/SessionView';
import PortalBanners from '@/components/client/PortalBanners';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function ClientPortalPage({ params }: Props) {
  const { clientId } = await params;
  const supabase     = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify this user is the client (or their PT)
  const { data: viewer } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isOwnPortal = user.id === clientId;
  const isPT        = viewer?.role === 'pt';

  if (!isOwnPortal && !isPT) redirect('/login');

  // Load client profile
  const { data: client } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', clientId)
    .single();

  if (!client) notFound();

  // Load client agreement
  const { data: agreement } = await supabase
    .from('client_agreements')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Load today's session (or most recent upcoming)
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      session_items (
        *,
        exercise: exercises (*)
      )
    `)
    .eq('client_id', clientId)
    .gte('scheduled_date', today)
    .order('scheduled_date', { ascending: true })
    .limit(1);

  const session = sessions?.[0] ?? null;

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
    return (
      <div className="min-h-screen bg-surface-0">
        <header className="sticky top-0 bg-surface-0/90 backdrop-blur-md border-b border-surface-border z-20">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <span className="text-slate-300 font-semibold font-mono text-sm">brigid.pro</span>
            <span className="text-xs font-mono text-slate-600">{client.full_name?.split(' ')[0]}</span>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">
          <PortalBanners agreement={agreement as ClientAgreement} />
          <div className="py-16 text-center space-y-3">
            <p className="text-4xl">◈</p>
            <h1 className="text-xl font-semibold text-slate-200">No Session Today</h1>
            <p className="text-slate-500 font-mono text-sm">
              Rest well, {client.full_name?.split(' ')[0] ?? 'athlete'}.
            </p>
            <p className="text-slate-600 text-xs font-mono">Recovery is part of the programme.</p>
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
    />
  );
}
