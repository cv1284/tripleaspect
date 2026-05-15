import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Params { params: Promise<{ id: string }> }

// GET — fetch single agreement (PT only)
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('client_agreements')
    .select(`*, client:profiles!client_agreements_client_id_fkey(*)`)
    .eq('id', id)
    .eq('pt_id', user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE — remove client agreement (PT only)
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('client_agreements')
    .delete()
    .eq('id', id)
    .eq('pt_id', user.id);   // PT can only delete their own agreements

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

// PATCH — update agreement (PT only)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Whitelist updatable fields
  const allowed = [
    'status', 'agreement_model', 'start_date', 'renewal_date', 'program_length_weeks',
    'parq_signed', 'parq_storage_url',
    'waiver_signed', 'waiver_storage_url',
    'consent_signed', 'consent_storage_url',
    'manual_price_numeric', 'manual_currency', 'billing_notes',
  ] as const;

  const payload = Object.fromEntries(
    Object.entries(body).filter(([k]) => (allowed as readonly string[]).includes(k)),
  );

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('client_agreements')
    .update(payload)
    .eq('id', id)
    .eq('pt_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
