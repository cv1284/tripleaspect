import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/lib/utils';

export interface WeekAdherence {
  week_start:  string;   // ISO date of Monday
  scheduled:   number;
  completed:   number;
  rate:        number;   // 0–1
}

// GET /api/pt/adherence?clientId=<uuid>&weeks=<n>
// Returns per-week scheduled vs completed session counts.
// PT-only endpoint.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'pt') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  if (!isValidUuid(clientId)) return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });

  const weeks = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('weeks') ?? '12'), 1), 52);

  // Confirm PT has this client
  const { data: agreement } = await supabase
    .from('client_agreements').select('id, start_date')
    .eq('pt_id', user.id).eq('client_id', clientId).maybeSingle();
  if (!agreement) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Compute the Monday `weeks` weeks ago — all arithmetic in UTC to match
  // how session scheduled_dates are parsed in the loop below (T00:00:00Z).
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeekUTC = (todayUTC.getUTCDay() + 6) % 7; // 0 = Mon
  const thisMonday = new Date(todayUTC);
  thisMonday.setUTCDate(thisMonday.getUTCDate() - dayOfWeekUTC);
  const rangeStart = new Date(thisMonday);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - (weeks - 1) * 7);
  const rangeStartStr = rangeStart.toISOString().split('T')[0];

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('scheduled_date, completed_at')
    .eq('client_id', clientId)
    .eq('pt_id', user.id)
    .gte('scheduled_date', rangeStartStr)
    .not('scheduled_date', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group into ISO weeks (Monday-anchored)
  const weekMap = new Map<string, { scheduled: number; completed: number }>();

  for (let i = 0; i < weeks; i++) {
    const d = new Date(rangeStart);
    d.setUTCDate(d.getUTCDate() + i * 7);
    weekMap.set(d.toISOString().split('T')[0], { scheduled: 0, completed: 0 });
  }

  for (const s of sessions ?? []) {
    if (!s.scheduled_date) continue;
    const d       = new Date(s.scheduled_date + 'T00:00:00Z');
    const dayOfWk = (d.getUTCDay() + 6) % 7; // 0=Mon
    const mon     = new Date(d);
    mon.setUTCDate(mon.getUTCDate() - dayOfWk);
    const weekKey = mon.toISOString().split('T')[0];
    const bucket  = weekMap.get(weekKey);
    if (!bucket) continue;
    bucket.scheduled++;
    if (s.completed_at) bucket.completed++;
  }

  const result: WeekAdherence[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week_start, { scheduled, completed }]) => ({
      week_start,
      scheduled,
      completed,
      rate: scheduled > 0 ? completed / scheduled : 0,
    }));

  return NextResponse.json(result);
}
