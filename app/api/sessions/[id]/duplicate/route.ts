import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Params { params: Promise<{ id: string }> }

// POST /api/sessions/[id]/duplicate
// Creates a copy of the session and all its items. Returns the new session.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch original session + items — PT must own it
  const { data: original } = await supabase
    .from('sessions')
    .select(`
      id, pt_id, client_id, title, category, notes,
      session_items (
        exercise_id, sort_order, prescribed_metrics,
        custom_coaching_cues, custom_youtube_url
      )
    `)
    .eq('id', sessionId)
    .eq('pt_id', user.id)
    .single();

  if (!original) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // Insert the new session
  const { data: newSession, error: sessionErr } = await supabase
    .from('sessions')
    .insert({
      pt_id:          original.pt_id,
      client_id:      original.client_id,
      title:          `${original.title} (Copy)`,
      category:       original.category,
      notes:          original.notes,
      scheduled_date: null,
      completed_at:   null,
    })
    .select('id, pt_id, client_id, title, category, scheduled_date, completed_at, notes, created_at, updated_at')
    .single();

  if (sessionErr || !newSession) {
    return NextResponse.json({ error: sessionErr?.message ?? 'Failed to duplicate' }, { status: 500 });
  }

  // Clone items
  const items = (original.session_items ?? []) as {
    exercise_id: string;
    sort_order: number;
    prescribed_metrics: Record<string, unknown>;
    custom_coaching_cues: string | null;
    custom_youtube_url: string | null;
  }[];

  if (items.length > 0) {
    const { error: itemErr } = await supabase
      .from('session_items')
      .insert(
        items.map(item => ({
          session_id:           newSession.id,
          exercise_id:          item.exercise_id,
          sort_order:           item.sort_order,
          prescribed_metrics:   item.prescribed_metrics,
          custom_coaching_cues: item.custom_coaching_cues,
          custom_youtube_url:   item.custom_youtube_url,
        }))
      );
    if (itemErr) {
      return NextResponse.json({ error: itemErr.message }, { status: 500 });
    }
  }

  return NextResponse.json(newSession, { status: 201 });
}
