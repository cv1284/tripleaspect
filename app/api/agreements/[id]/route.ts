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
    'deletion_scheduled_at', 'deletion_reason',
  ] as const;

  const payload = Object.fromEntries(
    Object.entries(body).filter(([k]) => (allowed as readonly string[]).includes(k)),
  );

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Validate enum fields before hitting the DB to return 400 instead of raw 500
  const validStatuses = ['active', 'attention', 'paused', 'inactive'];
  if ('status' in payload && !validStatuses.includes(payload.status as string)) {
    return NextResponse.json({ error: 'Invalid status. Must be one of: active, attention, paused, inactive' }, { status: 400 });
  }
  const validModels = ['subscription', 'fixed_block', 'hybrid'];
  if ('agreement_model' in payload && !validModels.includes(payload.agreement_model as string)) {
    return NextResponse.json({ error: 'Invalid agreement_model. Must be one of: subscription, fixed_block, hybrid' }, { status: 400 });
  }

  // Coerce and validate program_length_weeks if provided
  if ('program_length_weeks' in payload && payload.program_length_weeks !== null) {
    const weeks = Number(payload.program_length_weeks);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 260) {
      return NextResponse.json({ error: 'program_length_weeks must be an integer between 1 and 260' }, { status: 400 });
    }
    payload.program_length_weeks = weeks;
  }

  // Validate manual_price_numeric if provided
  if ('manual_price_numeric' in payload && payload.manual_price_numeric !== null) {
    const price = Number(payload.manual_price_numeric);
    if (isNaN(price) || !isFinite(price) || price < 0 || price > 1_000_000) {
      return NextResponse.json({ error: 'manual_price_numeric must be a number between 0 and 1,000,000' }, { status: 400 });
    }
    payload.manual_price_numeric = price;
  }

  // Validate doc storage URLs — only http/https accepted to prevent javascript:/data: XSS
  const docUrlFields = ['parq_storage_url', 'waiver_storage_url', 'consent_storage_url'] as const;
  for (const field of docUrlFields) {
    if (field in payload && payload[field] !== null) {
      const val = payload[field] as string;
      if (typeof val === 'string' && val) {
        try {
          const { protocol } = new URL(val);
          if (protocol !== 'http:' && protocol !== 'https:') {
            return NextResponse.json({ error: `${field}: only http/https URLs are accepted` }, { status: 400 });
          }
        } catch {
          return NextResponse.json({ error: `${field}: must be a valid URL` }, { status: 400 });
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('client_agreements')
    .update(payload)
    .eq('id', id)
    .eq('pt_id', user.id)
    .select()
    .single();

  if (error) {
    // PGRST116 = no rows matched — the agreement doesn't exist or belongs to another PT
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
