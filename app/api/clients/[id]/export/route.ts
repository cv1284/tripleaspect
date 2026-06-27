import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidUuid }       from '@/lib/utils';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: clientId } = await params;
  if (!isValidUuid(clientId)) return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify caller is a PT and owns an agreement with this client
  const { data: agreement } = await supabase
    .from('client_agreements')
    .select('*')
    .eq('pt_id', user.id)
    .eq('client_id', clientId)
    .single();

  if (!agreement) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Use admin client to read full profile (bypasses RLS edge cases)
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .eq('id', clientId)
    .single();

  // Fetch all sessions with their items and exercise names
  const { data: sessions } = await admin
    .from('sessions')
    .select(`
      id, title, category, scheduled_date, completed_at, notes, created_at,
      session_items (
        id, sort_order, prescribed_metrics, custom_coaching_cues, custom_youtube_url,
        exercise:exercises ( id, name, category, coaching_cues, tags )
      )
    `)
    .eq('client_id', clientId)
    .eq('pt_id', user.id)
    .order('scheduled_date', { ascending: false });

  const exportPayload = {
    export_metadata: {
      exported_at:     new Date().toISOString(),
      exported_by_pt:  user.email,
      brigid_pro_version: '1.0',
      note: 'This file can be re-imported to restore this client\'s data if they return.',
    },
    profile,
    agreement: {
      model:                agreement.agreement_model,
      status:               agreement.status,
      start_date:           agreement.start_date,
      renewal_date:         agreement.renewal_date,
      program_length_weeks: agreement.program_length_weeks,
      manual_price_numeric: agreement.manual_price_numeric,
      manual_currency:      agreement.manual_currency,
      parq_signed:          agreement.parq_signed,
      waiver_signed:        agreement.waiver_signed,
      consent_signed:       agreement.consent_signed,
    },
    sessions: sessions ?? [],
    summary: {
      total_sessions:    (sessions ?? []).length,
      completed_sessions: (sessions ?? []).filter(s => s.completed_at).length,
    },
  };

  const filename = `brigid-pro_${(profile?.full_name ?? profile?.email ?? clientId)
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`;

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      'Content-Type':        'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
