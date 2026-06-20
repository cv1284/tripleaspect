import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import { Session }      from '@/types/database';
import { format, parseISO } from 'date-fns';
import PortalNav from '@/components/client/PortalNav';
import HistoryClient, { PersonalRecord, WellbeingCheckinData } from '@/components/client/HistoryClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ clientId: string }>;
}

function groupByMonth(sessions: Session[]): [string, Session[]][] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.scheduled_date
      ? format(parseISO(s.scheduled_date), 'MMMM yyyy')
      : 'Unscheduled';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries());
}

export default async function HistoryPage({ params }: Props) {
  const { clientId } = await params;
  const supabase     = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (user.id !== clientId) redirect('/pt/clients');

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      session_items (
        id, sort_order, prescribed_metrics,
        exercise:exercises ( id, name, category )
      )
    `)
    .eq('client_id', clientId)
    .lte('scheduled_date', today)
    .order('scheduled_date', { ascending: false })
    .limit(100);

  const { data: checkins } = await supabase
    .from('wellbeing_checkins')
    .select('id, sleep, stress, soreness, notes, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Personal records: lifetime bests per exercise per metric from completed sessions
  const { data: rawItems } = await supabase
    .from('session_items')
    .select(`
      id, prescribed_metrics,
      exercise:exercises ( id, name, category ),
      session:sessions!inner ( id, title, scheduled_date, client_id, completed_at )
    `)
    .eq('session.client_id', clientId)
    .not('session.completed_at', 'is', null);

  const trackedMetrics = [
    { key: 'weight_kg',        unit: 'kg'   },
    { key: 'reps',             unit: 'reps' },
    { key: 'distance_km',      unit: 'km'   },
    { key: 'duration_minutes', unit: 'min'  },
  ];
  const bests = new Map<string, PersonalRecord>();
  for (const item of rawItems ?? []) {
    const ex      = item.exercise as unknown as { id: string; name: string; category: string } | null;
    const session = item.session  as unknown as { title: string; scheduled_date: string | null; completed_at: string | null } | null;
    const metrics = item.prescribed_metrics as Record<string, unknown> | null;
    if (!ex || !session || !metrics) continue;
    const achievedAt = session.completed_at ?? session.scheduled_date ?? '';
    for (const { key, unit } of trackedMetrics) {
      const raw = metrics[key];
      if (raw == null) continue;
      const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
      if (!isFinite(num) || num <= 0) continue;
      const mapKey = `${ex.id}::${key}`;
      const existing = bests.get(mapKey);
      if (!existing || num > existing.value) {
        bests.set(mapKey, {
          exercise_id:   ex.id,
          exercise_name: ex.name,
          category:      ex.category,
          metric:        key,
          value:         num,
          unit,
          achieved_at:   achievedAt,
          session_title: session.title,
        });
      }
    }
  }
  const records: PersonalRecord[] = Array.from(bests.values())
    .sort((a, b) => a.category.localeCompare(b.category) || a.exercise_name.localeCompare(b.exercise_name));

  const groups = groupByMonth((sessions ?? []) as Session[]);

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="sticky top-0 z-20 bg-surface-0/90 backdrop-blur-md border-b border-surface-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-slate-300 font-semibold font-mono text-sm tracking-tight">brigid.pro</span>
          <span className="text-xs font-mono text-slate-600">History</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        <HistoryClient
          groups={groups}
          checkins={(checkins ?? []) as WellbeingCheckinData[]}
          records={records}
        />
      </main>

      <PortalNav clientId={clientId} />
    </div>
  );
}
