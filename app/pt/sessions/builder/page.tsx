import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Exercise } from '@/types/database';
import SessionBuilderClient from './SessionBuilderClient';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ clientId?: string; sessionId?: string }>;
}

export default async function SessionBuilderPage({ searchParams }: Props) {
  const params   = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'pt') redirect(`/portal/${user.id}`);

  // Load full exercise library
  const { data: exercises } = await supabase
    .from('exercises')
    .select('*')
    .or(`is_custom.eq.false,created_by_pt_id.eq.${user.id}`)
    .order('category')
    .order('name');

  // Load existing session if editing
  let initialSession = null;
  if (params.sessionId) {
    const { data: session } = await supabase
      .from('sessions')
      .select(`*, session_items(*, exercise:exercises(*))`)
      .eq('id', params.sessionId)
      .eq('pt_id', user.id)
      .single();
    initialSession = session;
  }

  // Resolve client — guard against the literal string "undefined" from template URLs
  const clientId = params.clientId ?? initialSession?.client_id;
  if (!clientId || clientId === 'undefined') redirect('/pt/clients');

  return (
    <div className="min-h-screen bg-surface-0 py-4 px-4 lg:py-8">
      <SessionBuilderClient
        ptId={user.id}
        clientId={clientId}
        exercises={(exercises ?? []) as Exercise[]}
        initialSession={initialSession}
      />
    </div>
  );
}
