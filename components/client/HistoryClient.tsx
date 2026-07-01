'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Session, SessionCategory } from '@/types/database';
import { CATEGORY_CONFIG, formatMetricsSummary } from '@/lib/utils';

// ─── Local types ─────────────────────────────────────────────

export type PersonalRecord = {
  exercise_id:   string;
  exercise_name: string;
  category:      string;
  metric:        string;
  value:         number;
  unit:          string;
  achieved_at:   string;
  session_title: string;
};

export type WellbeingCheckinData = {
  id:         string;
  sleep:      number;
  stress:     number;
  soreness:   number;
  notes:      string | null;
  created_at: string;
};

const METRIC_LABELS: Record<string, string> = {
  weight_kg:        'Weight',
  reps:             'Reps',
  distance_km:      'Distance',
  duration_minutes: 'Duration',
};

// ─── Helpers ─────────────────────────────────────────────────

function scoreClass(metric: 'sleep' | 'stress' | 'soreness', val: number) {
  const good = metric === 'sleep' ? val >= 4 : val <= 2;
  const bad  = metric === 'sleep' ? val <= 2 : val >= 4;
  if (good) return 'text-emerald-400';
  if (bad)  return 'text-rose-400';
  return 'text-amber-400';
}

function scoreLabel(metric: 'sleep' | 'stress' | 'soreness', val: number): string {
  if (metric === 'sleep') {
    return ['', 'Poor', 'Fair', 'OK', 'Good', 'Great'][val] ?? String(val);
  }
  if (metric === 'stress') {
    return ['', 'Low', 'Mild', 'Moderate', 'High', 'Very high'][val] ?? String(val);
  }
  return ['', 'None', 'Mild', 'Moderate', 'Sore', 'Very sore'][val] ?? String(val);
}

// ─── Session Card ─────────────────────────────────────────────

function SessionCard({ session, today }: { session: Session; today: string }) {
  const [expanded, setExpanded] = useState(false);

  const cfg       = CATEGORY_CONFIG[session.category];
  const dateStr   = session.scheduled_date
    ? format(parseISO(session.scheduled_date), 'EEE d MMM yyyy')
    : '—';
  const completedAt = session.completed_at
    ? format(parseISO(session.completed_at), 'HH:mm')
    : null;
  const isMissed = !session.completed_at && !!session.scheduled_date && session.scheduled_date < today;
  const items = (session.session_items ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const hasDetail = items.length > 0 || !!session.notes || !!session.client_notes;

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full p-4 flex items-center gap-4 text-left"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
          <span className={`text-base leading-none ${cfg.color}`}>{cfg.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200 truncate">{session.title}</p>
          <p className="text-xs font-mono text-slate-500 mt-0.5">{dateStr}</p>
        </div>

        <div className="text-right flex-shrink-0">
          {completedAt ? (
            <p className="text-xs font-mono text-emerald-400">✓ {completedAt}</p>
          ) : isMissed ? (
            <p className="text-xs font-mono text-amber-600">○ Missed</p>
          ) : null}
          {items.length > 0 && (
            <p className="text-2xs font-mono text-slate-600 mt-0.5">
              {items.length} exercise{items.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {hasDetail && (
          <span
            className={`text-slate-600 text-xs flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▾
          </span>
        )}
      </button>

      {expanded && hasDetail && (
        <div className="border-t border-surface-border px-4 pt-3 pb-4 space-y-2.5">
          {items.map(item => {
            const ex = item.exercise;
            if (!ex) return null;
            const metricStr = formatMetricsSummary(
              item.prescribed_metrics as Record<string, unknown>,
              ex.category as SessionCategory,
            );
            return (
              <div key={item.id} className="flex items-start gap-3">
                <div className="w-1 h-1 rounded-full bg-slate-600 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300">{ex.name}</p>
                  {metricStr !== '—' && (
                    <p className="text-xs font-mono text-slate-600 mt-0.5">{metricStr}</p>
                  )}
                </div>
              </div>
            );
          })}

          {(session.notes || session.client_notes) && (
            <div className="pt-2 mt-1 border-t border-surface-border space-y-1.5">
              {session.notes && (
                <p className="text-xs text-slate-600 italic">{session.notes}</p>
              )}
              {session.client_notes && (
                <p className="text-xs font-mono text-indigo-400/80 italic">&ldquo;{session.client_notes}&rdquo;</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Checkin Card ─────────────────────────────────────────────

const SCORE_FIELDS = ['sleep', 'stress', 'soreness'] as const;
type ScoreField = typeof SCORE_FIELDS[number];

function CheckinCard({ c }: { c: WellbeingCheckinData }) {
  const [editing, setEditing] = useState(false);
  const [scores,  setScores]  = useState({ sleep: c.sleep, stress: c.stress, soreness: c.soreness });
  const [notes,   setNotes]   = useState(c.notes ?? '');
  const [saving,  setSaving]  = useState(false);
  const [current, setCurrent] = useState(c);

  const dateStr = format(parseISO(current.created_at), 'EEE d MMM yyyy');

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/checkin/${current.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...scores, notes: notes.trim() || null }),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json() as WellbeingCheckinData;
      setCurrent(updated);
      setScores({ sleep: updated.sleep, stress: updated.stress, soreness: updated.soreness });
      setNotes(updated.notes ?? '');
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setScores({ sleep: current.sleep, stress: current.stress, soreness: current.soreness });
    setNotes(current.notes ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="card p-4 space-y-4">
        <p className="text-xs font-mono text-slate-500">{dateStr}</p>

        <div className="space-y-3">
          {SCORE_FIELDS.map(field => (
            <div key={field} className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-500 w-16 capitalize">{field}</span>
              <div className="flex gap-1.5">
                {([1, 2, 3, 4, 5] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setScores(s => ({ ...s, [field]: n }))}
                    className={`w-8 h-8 rounded-lg text-xs font-mono font-semibold transition-colors ${
                      scores[field] === n
                        ? `${scoreClass(field, n)} bg-surface-3 ring-1 ring-inset ring-surface-border`
                        : 'text-slate-600 hover:text-slate-400'
                    }`}
                    title={scoreLabel(field, n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className={`text-xs font-mono ${scoreClass(field, scores[field])}`}>
                {scoreLabel(field, scores[field])}
              </span>
            </div>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          maxLength={500}
          className="w-full bg-surface-3 border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-600 font-mono resize-none focus:outline-none focus:border-indigo-500"
        />

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="flex-1 py-2 rounded-lg border border-surface-border text-slate-400 text-xs font-mono hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-3 flex items-center gap-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-900/40">
        <span className="text-base leading-none text-indigo-400">◎</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-slate-500">{dateStr}</p>
        {current.notes && (
          <p className="text-2xs text-slate-600 truncate mt-0.5">{current.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 text-xs font-mono">
        <span className={scoreClass('sleep',    current.sleep)}>Slp:{current.sleep}</span>
        <span className="text-slate-700">·</span>
        <span className={scoreClass('stress',   current.stress)}>Str:{current.stress}</span>
        <span className="text-slate-700">·</span>
        <span className={scoreClass('soreness', current.soreness)}>Srs:{current.soreness}</span>
      </div>

      <button
        onClick={() => setEditing(true)}
        className="text-slate-600 hover:text-slate-300 text-sm flex-shrink-0 transition-colors ml-1"
        aria-label="Edit check-in"
        title="Edit check-in"
      >
        ✎
      </button>
    </div>
  );
}

// ─── Record Row ───────────────────────────────────────────────

function RecordRow({ r }: { r: PersonalRecord }) {
  const cfg     = CATEGORY_CONFIG[r.category as keyof typeof CATEGORY_CONFIG];
  const dateStr = r.achieved_at
    ? format(parseISO(r.achieved_at), 'EEE d MMM yyyy')
    : '—';
  const label   = METRIC_LABELS[r.metric] ?? r.metric;
  const display = r.unit === 'reps' ? `${r.value} reps`
    : r.unit === 'kg'  ? `${r.value} kg`
    : r.unit === 'km'  ? `${r.value} km`
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

// ─── Main export ──────────────────────────────────────────────

interface Props {
  groups:   [string, Session[]][];
  checkins: WellbeingCheckinData[];
  records:  PersonalRecord[];
  today:    string;
}

export default function HistoryClient({ groups, checkins, records, today }: Props) {
  return (
    <div className="space-y-6">
      {groups.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-4xl">⬡</p>
          <h1 className="text-lg font-semibold text-slate-300">No sessions yet</h1>
          <p className="text-slate-500 font-mono text-sm">Your completed sessions will appear here.</p>
        </div>
      ) : (
        groups.map(([month, monthSessions]) => (
          <div key={month} className="space-y-2">
            <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest px-1">{month}</h2>
            {monthSessions.map(s => (
              <SessionCard key={s.id} session={s} today={today} />
            ))}
          </div>
        ))
      )}

      {checkins.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest px-1">Wellbeing Check-ins</h2>
          {checkins.map(c => (
            <CheckinCard key={c.id} c={c} />
          ))}
        </div>
      )}

      {records.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest px-1">Personal Records</h2>
          {records.map(r => (
            <RecordRow key={`${r.exercise_id}::${r.metric}`} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
