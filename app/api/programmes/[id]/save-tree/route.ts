import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readJsonBody, isValidUuid } from '@/lib/utils';

interface SessionPayload {
  day_of_week:  number;
  title:        string;
  category:     string;
  notes:        string | null;
  sort_order:   number;
  template_id:  string | null;
}

interface WeekPayload {
  id:       string;
  sessions: SessionPayload[];
}

// POST /api/programmes/[id]/save-tree
// Replaces the session grid for a programme. Accepts an array of week objects,
// each with their DB UUID and an array of sessions. Existing sessions are wiped
// per-week and replaced — safe because session items are not yet authored in the builder.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isValidUuid(id)) return NextResponse.json({ error: 'Programme not found' }, { status: 404 });

  // Verify ownership
  const { data: prog } = await supabase
    .from('programmes')
    .select('id')
    .eq('id', id)
    .eq('pt_id', user.id)
    .maybeSingle();
  if (!prog) return NextResponse.json({ error: 'Programme not found' }, { status: 404 });

  const body = await readJsonBody(req);
  if (!body || !Array.isArray((body as { weeks?: unknown }).weeks)) {
    return NextResponse.json({ error: 'weeks array required' }, { status: 400 });
  }

  const weeks = (body as { weeks: WeekPayload[] }).weeks;
  const validCategories = ['healing', 'forging', 'verse'];

  for (const week of weeks) {
    if (!isValidUuid(week.id)) continue;

    // Wipe existing sessions for this week then re-insert
    await supabase.from('programme_sessions').delete().eq('week_id', week.id);

    const valid = (week.sessions ?? []).filter(
      s => s.title?.trim() && validCategories.includes(s.category) && s.day_of_week >= 1 && s.day_of_week <= 7,
    );

    if (valid.length > 0) {
      await supabase.from('programme_sessions').insert(
        valid.map((s, idx) => ({
          week_id:     week.id,
          day_of_week: s.day_of_week,
          title:       s.title.trim(),
          category:    s.category,
          notes:       s.notes || null,
          sort_order:  s.sort_order ?? idx,
          template_id: isValidUuid(s.template_id ?? '') ? s.template_id : null,
        })),
      );
    }
  }

  return NextResponse.json({ ok: true });
}
