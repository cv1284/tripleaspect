import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/lib/utils';

// GET /api/sessions?clientId=<uuid>
// Returns all sessions a PT has created for a specific client.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  if (!isValidUuid(clientId)) return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });

  // Confirm this PT has an agreement with the client
  const { data: agreement } = await supabase
    .from('client_agreements')
    .select('id')
    .eq('pt_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle();
  if (!agreement) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, title, category, scheduled_date, completed_at, client_notes')
    .eq('client_id', clientId)
    .eq('pt_id', user.id)
    .order('scheduled_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(sessions ?? []);
}
