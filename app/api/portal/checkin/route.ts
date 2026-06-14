import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readJsonBody, isValidUuid } from '@/lib/utils';

// POST /api/portal/checkin — client submits a pre-session wellbeing check-in
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'client') {
    return NextResponse.json({ error: 'Only clients can submit check-ins' }, { status: 403 });
  }

  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { sleep, stress, soreness, notes, session_id } = body as {
    sleep?: unknown; stress?: unknown; soreness?: unknown; notes?: unknown; session_id?: unknown;
  };

  const scores = { sleep, stress, soreness };
  for (const [key, val] of Object.entries(scores)) {
    const n = Number(val);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return NextResponse.json({ error: `${key} must be an integer between 1 and 5` }, { status: 400 });
    }
  }

  // Prevent duplicate check-ins for the same session
  if (session_id) {
    if (typeof session_id !== 'string' || !isValidUuid(session_id)) {
      return NextResponse.json({ error: 'session_id must be a valid id' }, { status: 400 });
    }
    const { data: existing } = await supabase
      .from('wellbeing_checkins')
      .select('id')
      .eq('client_id', user.id)
      .eq('session_id', session_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'Check-in already submitted for this session' }, { status: 409 });
    }
  }

  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .insert({
      client_id:  user.id,
      session_id: session_id ?? null,
      sleep:      Number(sleep),
      stress:     Number(stress),
      soreness:   Number(soreness),
      notes:      typeof notes === 'string' ? notes.trim().slice(0, 500) || null : null,
    })
    .select('id, sleep, stress, soreness, notes, session_id, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// GET /api/portal/checkin?sessionId= — fetch check-in for a specific session (or latest)
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get('sessionId');
  const clientId  = req.nextUrl.searchParams.get('clientId'); // PT fetching a client's check-in

  if (sessionId && !isValidUuid(sessionId)) {
    return NextResponse.json({ error: 'sessionId must be a valid id' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();

  let targetClientId = user.id;

  if (profile?.role === 'pt' && clientId) {
    // Verify the PT has an agreement with this client
    const { data: agreement } = await supabase
      .from('client_agreements').select('id')
      .eq('pt_id', user.id).eq('client_id', clientId).maybeSingle();
    if (!agreement) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    targetClientId = clientId;
  }

  let query = supabase
    .from('wellbeing_checkins')
    .select('id, sleep, stress, soreness, notes, session_id, created_at')
    .eq('client_id', targetClientId)
    .order('created_at', { ascending: false });

  if (sessionId) {
    query = query.eq('session_id', sessionId).limit(1);
  } else {
    query = query.limit(10);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For session-specific lookup, return single object or null
  if (sessionId) {
    return NextResponse.json(data?.[0] ?? null);
  }
  return NextResponse.json(data ?? []);
}
