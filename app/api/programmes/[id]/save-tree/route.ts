import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readJsonBody, isValidUuid, stripHtmlTags } from '@/lib/utils';

interface SessionPayload {
  id?:          unknown; // real DB UUID for an existing session, or a client-local placeholder (e.g. "local_...") for a new one
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
// Reconciles the session grid for a programme. Accepts an array of week objects,
// each with their DB UUID and an array of sessions. Sessions whose id already
// exists on that week are updated in place (preserving their programme_session_items,
// which cascade-delete if the row itself is deleted); sessions with no matching
// existing id are inserted as new; existing sessions no longer present in the
// payload are deleted (correctly cascading their items, since the session itself
// was removed from the grid).
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

  // Reject duplicate week ids up front — with duplicates, the sequential
  // delete+insert loop below would let a later occurrence's delete wipe an
  // earlier occurrence's just-inserted sessions, silently discarding data.
  const idCounts = new Map<string, number>();
  for (const w of weeks) idCounts.set(w.id, (idCounts.get(w.id) ?? 0) + 1);
  if ([...idCounts.values()].some(n => n > 1)) {
    return NextResponse.json({ error: 'Duplicate week id in payload; no changes were saved' }, { status: 400 });
  }

  // Verify every referenced week actually belongs to *this* programme —
  // without this, a caller could target another one of their own (or, if
  // RLS were ever misconfigured, another PT's) programme's weeks by id.
  const requestedIds = weeks.map(w => w.id).filter(isValidUuid);
  const { data: ownedWeeks } = requestedIds.length
    ? await supabase
        .from('programme_weeks')
        .select('id')
        .eq('programme_id', id)
        .in('id', requestedIds)
    : { data: [] };
  const ownedWeekIds = new Set((ownedWeeks ?? []).map(w => w.id));
  const targetWeeks = weeks.filter(w => isValidUuid(w.id) && ownedWeekIds.has(w.id));

  // Every week in the payload must resolve to an owned week — silently
  // dropping unresolved ones would return {ok:true} while part of the tree
  // (e.g. a week with a stale/invalid id from a race or bad client state)
  // was never saved, with no signal to the caller.
  if (targetWeeks.length !== weeks.length) {
    return NextResponse.json({ error: 'One or more weeks were not found on this programme; no changes were saved' }, { status: 400 });
  }

  // Validate every session in every targeted week BEFORE writing anything —
  // otherwise one invalid session anywhere in the payload silently applies
  // a partial save with no signal to the caller.
  for (const week of targetWeeks) {
    for (const s of week.sessions ?? []) {
      const validSession =
        typeof s.title === 'string' && s.title.trim() &&
        validCategories.includes(s.category) &&
        typeof s.day_of_week === 'number' && Number.isInteger(s.day_of_week) &&
        s.day_of_week >= 1 && s.day_of_week <= 7;
      if (!validSession) {
        return NextResponse.json({ error: 'One or more sessions failed validation; no changes were saved' }, { status: 400 });
      }
    }
  }

  // Fetch existing sessions for the targeted weeks so we can reconcile
  // (update in place / insert / delete) instead of wiping and reinserting —
  // a blind wipe would cascade-delete every session's programme_session_items.
  const { data: existingSessions } = await supabase
    .from('programme_sessions')
    .select('id, week_id')
    .in('week_id', targetWeeks.map(w => w.id));
  const existingIdsByWeek = new Map<string, Set<string>>();
  for (const s of existingSessions ?? []) {
    if (!existingIdsByWeek.has(s.week_id)) existingIdsByWeek.set(s.week_id, new Set());
    existingIdsByWeek.get(s.week_id)!.add(s.id);
  }

  for (const week of targetWeeks) {
    const existingIds = existingIdsByWeek.get(week.id) ?? new Set<string>();
    const sessions = week.sessions ?? [];
    const keptIds = new Set(
      sessions.filter(s => typeof s.id === 'string' && existingIds.has(s.id)).map(s => s.id as string),
    );

    for (const [idx, s] of sessions.entries()) {
      const row = {
        day_of_week: s.day_of_week,
        title:       stripHtmlTags(s.title.trim()),
        category:    s.category,
        notes:       typeof s.notes === 'string' ? stripHtmlTags(s.notes) || null : null,
        sort_order:  s.sort_order ?? idx,
        template_id: isValidUuid(s.template_id ?? '') ? s.template_id : null,
      };
      if (typeof s.id === 'string' && keptIds.has(s.id)) {
        await supabase.from('programme_sessions').update(row).eq('id', s.id);
      } else {
        await supabase.from('programme_sessions').insert({ week_id: week.id, ...row });
      }
    }

    const toDeleteIds = [...existingIds].filter(id => !keptIds.has(id));
    if (toDeleteIds.length > 0) {
      await supabase.from('programme_sessions').delete().in('id', toDeleteIds);
    }
  }

  return NextResponse.json({ ok: true });
}
