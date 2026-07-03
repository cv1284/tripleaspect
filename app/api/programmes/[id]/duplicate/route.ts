import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/lib/utils';

// POST /api/programmes/[id]/duplicate
// PT-only. Deep-copies a programme (own or public) into the requesting PT's
// library. Copies: programme → weeks → sessions → session_items.
// New programme title is prefixed with "Copy of ".
export async function POST(
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
  if (profile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch source programme (own or public) with full tree
  const { data: src, error: srcErr } = await supabase
    .from('programmes')
    .select(`
      id, title, description, category, total_weeks,
      weeks:programme_weeks (
        id, week_number, label,
        sessions:programme_sessions (
          id, day_of_week, title, category, notes, sort_order, template_id,
          items:programme_session_items (
            id, exercise_id, sort_order, prescribed_metrics,
            custom_coaching_cues, custom_youtube_url
          )
        )
      )
    `)
    .eq('id', id)
    .or(`pt_id.eq.${user.id},is_public.eq.true`)
    .single();

  if (srcErr || !src) return NextResponse.json({ error: 'Programme not found' }, { status: 404 });

  // Insert new programme (is_public defaults false, owned by this PT)
  const rawTitle = `Copy of ${src.title}`;
  const newTitle = rawTitle.length > 100 ? rawTitle.slice(0, 100) : rawTitle;

  const { data: newProg, error: progErr } = await supabase
    .from('programmes')
    .insert({
      pt_id:       user.id,
      title:       newTitle,
      description: src.description ?? null,
      category:    src.category ?? null,
      total_weeks: src.total_weeks,
      is_public:   false,
    })
    .select('id, pt_id, title, description, category, total_weeks, is_public, created_at, updated_at')
    .single();

  if (progErr || !newProg) {
    return NextResponse.json({ error: progErr?.message ?? 'Failed to duplicate programme' }, { status: 500 });
  }

  const srcWeeks = (src.weeks ?? []) as Array<{
    id: string; week_number: number; label: string | null;
    sessions: Array<{
      id: string; day_of_week: number; title: string | null;
      category: string | null; notes: string | null;
      sort_order: number; template_id: string | null;
      items: Array<{
        exercise_id: string | null; sort_order: number;
        prescribed_metrics: Record<string, unknown> | null;
        custom_coaching_cues: string | null;
        custom_youtube_url: string | null;
      }>;
    }>;
  }>;

  for (const week of srcWeeks.sort((a, b) => a.week_number - b.week_number)) {
    const { data: newWeek, error: weekErr } = await supabase
      .from('programme_weeks')
      .insert({ programme_id: newProg.id, week_number: week.week_number, label: week.label ?? null })
      .select('id')
      .single();

    if (weekErr || !newWeek) continue;

    const sessions = (week.sessions ?? []).sort((a, b) => a.sort_order - b.sort_order);
    for (const session of sessions) {
      const { data: newSession, error: sessErr } = await supabase
        .from('programme_sessions')
        .insert({
          week_id:     newWeek.id,
          day_of_week: session.day_of_week,
          title:       session.title ?? null,
          category:    session.category ?? null,
          notes:       session.notes ?? null,
          sort_order:  session.sort_order,
          template_id: session.template_id ?? null,
        })
        .select('id')
        .single();

      if (sessErr || !newSession) continue;

      const items = (session.items ?? []).sort((a, b) => a.sort_order - b.sort_order);
      if (items.length === 0) continue;

      await supabase.from('programme_session_items').insert(
        items.map(item => ({
          session_id:           newSession.id,
          exercise_id:          item.exercise_id ?? null,
          sort_order:           item.sort_order,
          prescribed_metrics:   item.prescribed_metrics ?? null,
          custom_coaching_cues: item.custom_coaching_cues ?? null,
          custom_youtube_url:   item.custom_youtube_url ?? null,
        })),
      );
    }
  }

  return NextResponse.json(newProg, { status: 201 });
}
