import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Params { params: Promise<{ id: string }> }

// POST /api/programmes/[id]/assign
// Body: { clientId: string, startDate: string } — startDate is the Monday of week 1 (YYYY-MM-DD)
// Bulk-creates sessions + session_items from the programme tree.
export async function POST(req: NextRequest, { params }: Params) {
  const { id: programmeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { clientId, startDate } = await req.json();
  if (!clientId || !startDate) {
    return NextResponse.json({ error: 'clientId and startDate are required' }, { status: 400 });
  }

  const parsedMonday = new Date(startDate);
  if (isNaN(parsedMonday.getTime())) {
    return NextResponse.json({ error: 'startDate must be a valid ISO date (YYYY-MM-DD)' }, { status: 400 });
  }

  // Verify PT owns the programme
  const { data: programme, error: progErr } = await supabase
    .from('programmes')
    .select(`
      id, pt_id, title,
      weeks:programme_weeks (
        id, week_number,
        sessions:programme_sessions (
          id, day_of_week, title, category, notes,
          items:programme_session_items (
            exercise_id, sort_order, prescribed_metrics,
            custom_coaching_cues, custom_youtube_url
          )
        )
      )
    `)
    .eq('id', programmeId)
    .eq('pt_id', user.id)
    .single();

  if (progErr || !programme) {
    return NextResponse.json({ error: 'Programme not found' }, { status: 404 });
  }

  // Verify PT has an agreement with this client
  const { data: agreement } = await supabase
    .from('client_agreements')
    .select('id')
    .eq('pt_id', user.id)
    .eq('client_id', clientId)
    .single();

  if (!agreement) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const monday = parsedMonday;
  monday.setUTCHours(0, 0, 0, 0);

  type ProgrammeSessionItem = {
    exercise_id: string;
    sort_order: number;
    prescribed_metrics: Record<string, unknown>;
    custom_coaching_cues: string | null;
    custom_youtube_url: string | null;
  };

  type ProgrammeSession = {
    id: string;
    day_of_week: number;
    title: string;
    category: string;
    notes: string | null;
    items?: ProgrammeSessionItem[];
  };

  type ProgrammeWeek = {
    id: string;
    week_number: number;
    sessions?: ProgrammeSession[];
  };

  const weeks = (programme.weeks ?? []) as ProgrammeWeek[];
  let totalCreated = 0;

  for (const week of weeks) {
    for (const ps of (week.sessions ?? [])) {
      // Calculate the actual date: startDate + (week_number - 1) * 7 + (day_of_week - 1) days
      const scheduledDate = new Date(monday);
      scheduledDate.setUTCDate(
        monday.getUTCDate() + (week.week_number - 1) * 7 + (ps.day_of_week - 1)
      );

      const { data: newSession, error: sessionErr } = await supabase
        .from('sessions')
        .insert({
          pt_id:          user.id,
          client_id:      clientId,
          title:          ps.title,
          category:       ps.category,
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          notes:          ps.notes,
          completed_at:   null,
        })
        .select('id')
        .single();

      if (sessionErr || !newSession) continue;

      const items = ps.items ?? [];
      if (items.length > 0) {
        await supabase.from('session_items').insert(
          items.map(item => ({
            session_id:           newSession.id,
            exercise_id:          item.exercise_id,
            sort_order:           item.sort_order,
            prescribed_metrics:   item.prescribed_metrics,
            custom_coaching_cues: item.custom_coaching_cues,
            custom_youtube_url:   item.custom_youtube_url,
          }))
        );
      }

      totalCreated++;
    }
  }

  return NextResponse.json({ created: totalCreated });
}
