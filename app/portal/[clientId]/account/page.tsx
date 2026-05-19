import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { Profile, ClientAgreement } from '@/types/database';
import ClientAccountClient from './AccountClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function ClientAccountPage({ params }: Props) {
  const { clientId } = await params;
  const supabase     = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (user.id !== clientId) redirect(`/portal/${clientId}`);

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', clientId)
    .single();

  if (!profile) notFound();

  const { data: agreement } = await supabase
    .from('client_agreements')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="sticky top-0 z-20 bg-surface-0/90 backdrop-blur-md border-b border-surface-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-slate-300 font-semibold font-mono text-sm tracking-tight">brigid.pro</span>
          <span className="text-xs font-mono text-slate-600">Account</span>
        </div>
      </header>
      <ClientAccountClient
        profile={profile as Profile}
        clientId={clientId}
        agreement={agreement as ClientAgreement | null}
      />
    </div>
  );
}
