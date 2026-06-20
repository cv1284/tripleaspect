import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import { Session }      from '@/types/database';
import { CATEGORY_CONFIG } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import PortalNav from '@/components/client/PortalNav';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ clientId: string }>;
}

// ─── Personal Records ─────────────────────────────────────

type PersonalRecord = {
  exercise_id:   string;
  exercise_name: string;
  category:      string;
  metric:        string;
  value:         number;
  unit:          string;
  achieved_at:   string;
  session_title: string;
};

const METRIC_LABELS: Record<string, string> = {
  weight_kg:        'Weight',
  reps:             'Reps',
  distance_km:      'Distance',
  duration_minutes: 'Duration',
};

function RecordRow({ r }: { r: PersonalRecord }) {
  const cfg     = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
  const dateStr = r.achieved_at
    ? format(parseISO(r.achieved_at), 'EEE d MMM yyyy')
    : '—';
  const label = METRIC_LABELS[r.metric] ?? r.metric;
  const display = r.unit === 'reps'
    ? `${r.value} reps`
    : r.unit === 'kg'
    ? `${r.value} kg`
    : r.unit === 'km'
    ? `${r.value} km`
    : `${r.value} min`;

  return (
    <div className="card p-3 flex items-center gap-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg?.bg ?? 'bg-surface-3'}`}>
        <span className={`text-base leading-none ${cfg?.color ?? 'text-slate-400'}`}>{cfg?.icon ?? '◈'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{r.exercise_name}</p>
        <p className="text-xs font-mono text-slate-500 mt-0.5">{dateStr} · {r.session_title}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-mono font-semibold text-amber-400">{display}</p>
        <p className="text-2xs font-mono text-slate-600 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Wellbeing helpers ────────────────────────────────────

type WellbeingCheckin = {
  id:         string;
  sleep:      number;
  stress:     number;
  soreness:   number;
  notes:      string | null;
  created_at: string;
};

function scoreClass(metric: 'sleep' | 'stress' | 'soreness', val: number) {
  // sleep: higher = better; stress/soreness: lower = better
  const good = metric === 'sleep' ? val >= 4 : val <= 2;
  const bad  = metric === 'sleep' ? val <= 2 : val >= 4;
  if (good) return 'text-emerald-400';
  if (bad)  return 'text-rose-400';
  return 'text-amber-400';
}

function CheckinRow({ c }: { c: WellbeingCheckin }) {
  const dateStr = format(parseISO(c.created_at), 'EEE d MMM yyyy');
  return (
    <div className="card p-3 flex items-center gap-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-900/40">
        <span className="text-base leading-none text-indigo-400">◎</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-slate-500">{dateStr}</p>
        {c.notes && (
          <p className="text-2xs text-slate-600 truncate mt-0.5">{c.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 text-xs font-mono">
        <span className={scoreClass('sleep',    c.sleep)}>Slp:{c.sleep}</span>
        <span className="text-slate-700">·</span>
        <span className={scoreClass('stress',   c.stress)}>Str:{c.stress}</span>
        <span className="text-slate-700">·</span>
        <span className={scoreClass('soreness', c.soreness)}>Srs:{c.soreness}</span>
      </div>
    </div>
  );
}

// ─── Session Row ──────────────────────────────────────────

function SessionRow({ session }: { session: Session }) {
  const cfg        = CATEGORY_CONFIG[session.category];
  const dateStr    = session.scheduled_date
    ? format(parseISO(session.scheduled_date), 'EEE d MMM yyyy')
    : '—';
  const completedAt = session.completed_at
    ? format(parseISO(session.completed_at), 'HH:mm')
    : null;
  const itemCount = (session.session_items ?? []).length;

  return (
    <div className="card p-4 flex items-center gap-4">
      {/* Category icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
        <span className={`text-base leading-none ${cfg.color}`}>{cfg.icon}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{session.title}</p>
        <p className="text-xs font-mono text-slate-500 mt-0.5">{dateStr}</p>
      </div>

      {/* Right side */}
      <div className="text-right flex-shrink-0">
        {completedAt && (
          <p className="text-xs font-mono text-emerald-400">✓ {completedAt}</p>
        )}
        {itemCount > 0 && (
          <p className="text-2xs font-mono text-slate-600 mt-0.5">{itemCount} exercise{itemCount !== 1 ? 's' : ''}</p>
        )}
      </div>
    </div>
  );
}

// ─── Group sessions by month ──────────────────────────────

function groupByMonth(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.scheduled_date
      ? format(parseISO(s.scheduled_date), 'MMMM yyyy')
      : 'Unscheduled';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}

// ─── Page ─────────────────────────────────────────────────

export default async function HistoryPage({ params }: Props) {
  const { clientId } = await params;
  const supabase     = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const isOwnPortal = user.id === clientId;
  if (!isOwnPortal) {
    // PTs should use the PT dashboard, not the client history page
    redirect(`/pt/clients`);
  }

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      session_items ( id )
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
    { key: 'weight_kg', unit: 'kg' },
    { key: 'reps', unit: 'reps' },
    { key: 'distance_km', unit: 'km' },
    { key: 'duration_minutes', unit: 'min' },
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
        bests.set(mapKey, { exercise_id: ex.id, exercise_name: ex.name, category: ex.category,
          metric: key, value: num, unit, achieved_at: achievedAt, session_title: session.title });
      }
    }
  }
  const records: PersonalRecord[] = Array.from(bests.values())
    .sort((a, b) => a.category.localeCompare(b.category) || a.exercise_name.localeCompare(b.exercise_name));

  const groups = groupByMonth((sessions ?? []) as Session[]);

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-surface-0/90 backdrop-blur-md border-b border-surface-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-slate-300 font-semibold font-mono text-sm tracking-tight">brigid.pro</span>
          <span className="text-xs font-mono text-slate-600">History</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-6">

        {groups.size === 0 ? (
          <div className="py-20 text-center space-y-3">
            <p className="text-4xl">⬡</p>
            <h1 className="text-lg font-semibold text-slate-300">No sessions yet</h1>
            <p className="text-slate-500 font-mono text-sm">
              Your completed sessions will appear here.
            </p>
          </div>
        ) : (
          Array.from(groups.entries()).map(([month, monthSessions]) => (
            <div key={month} className="space-y-2">
              <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest px-1">
                {month}
              </h2>
              {monthSessions.map(s => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          ))
        )}

        {(checkins ?? []).length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest px-1">
              Wellbeing Check-ins
            </h2>
            {(checkins as WellbeingCheckin[]).map(c => (
              <CheckinRow key={c.id} c={c} />
            ))}
          </div>
        )}

        {records.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest px-1">
              Personal Records
            </h2>
            {records.map(r => (
              <RecordRow key={`${r.exercise_id}::${r.metric}`} r={r} />
            ))}
          </div>
        )}

      </main>
      <PortalNav clientId={clientId} />
    </div>
  );
}
