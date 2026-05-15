import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import { Session }      from '@/types/database';
import { CATEGORY_CONFIG } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ clientId: string }>;
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
    .lt('scheduled_date', today)
    .order('scheduled_date', { ascending: false })
    .limit(100);

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

      </main>
    </div>
  );
}
