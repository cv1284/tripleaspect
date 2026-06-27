import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readJsonBody, isValidUuid, stripHtmlTags } from '@/lib/utils';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'client') {
    return NextResponse.json({ error: 'Only clients can edit check-ins' }, { status: 403 });
  }

  // Ownership verified via RLS, but double-check for a clear 404 vs silent failure
  const { data: existing } = await supabase
    .from('wellbeing_checkins')
    .select('id')
    .eq('id', id)
    .eq('client_id', user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { sleep, stress, soreness, notes } = body as {
    sleep?: unknown; stress?: unknown; soreness?: unknown; notes?: unknown;
  };

  const update: Record<string, unknown> = {};

  for (const [key, val] of Object.entries({ sleep, stress, soreness })) {
    if (val !== undefined) {
      const n = Number(val);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return NextResponse.json({ error: `${key} must be an integer between 1 and 5` }, { status: 400 });
      }
      update[key] = n;
    }
  }

  if (notes !== undefined) {
    update['notes'] = typeof notes === 'string' ? stripHtmlTags(notes.trim()).slice(0, 500) || null : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .update(update)
    .eq('id', id)
    .eq('client_id', user.id)
    .select('id, sleep, stress, soreness, notes, session_id, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'client') {
    return NextResponse.json({ error: 'Only clients can delete check-ins' }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from('wellbeing_checkins')
    .select('id')
    .eq('id', id)
    .eq('client_id', user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('wellbeing_checkins')
    .delete()
    .eq('id', id)
    .eq('client_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
