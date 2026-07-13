interface CheckinData {
  sleep: number;
  stress: number;
  soreness: number;
  created_at: string;
}

export function ClientGoalCard({
  goalText, goalTargetDate, goalProgress,
}: {
  goalText:       string | null;
  goalTargetDate: string | null;
  goalProgress?:  number | null;
}) {
  if (!goalText) return null;

  const targetLabel = goalTargetDate
    ? new Date(goalTargetDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const pct = goalProgress ?? null;
  const achieved = pct === 100;

  return (
    <div className={`rounded-xl bg-surface-2 border px-4 py-3 ${achieved ? 'border-emerald-500/30' : 'border-indigo-500/20'}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{achieved ? '🎉' : '🎯'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200">{goalText}</p>
          {achieved ? (
            <p className="text-2xs font-mono text-emerald-400 mt-0.5">Goal achieved!</p>
          ) : targetLabel && (
            <p className="text-2xs font-mono text-slate-500 mt-0.5">Target: {targetLabel}</p>
          )}
        </div>
        {pct !== null && (
          <span className={`text-sm font-mono font-semibold flex-shrink-0 ${achieved ? 'text-emerald-400' : 'text-indigo-400'}`}>
            {achieved ? '100%' : `${pct}%`}
          </span>
        )}
      </div>
      {pct !== null && (
        <div className="mt-2.5">
          <div className="h-1.5 rounded-full bg-surface-border overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${achieved ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface Milestone {
  id:          string;
  text:        string;
  target_date: string | null;
  progress:    number;
}

export function ClientMilestonesCard({ milestones }: { milestones: Milestone[] }) {
  if (!milestones || milestones.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface-2 border border-surface-border px-4 py-3">
      <p className="text-2xs font-mono text-slate-500 uppercase tracking-wide mb-2.5">Milestones</p>
      <div className="space-y-3">
        {milestones.map(m => {
          const achieved = m.progress === 100;
          const targetLabel = m.target_date
            ? new Date(m.target_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : null;
          return (
            <div key={m.id}>
              <div className="flex items-center gap-2">
                <span className="text-base flex-shrink-0">{achieved ? '🎉' : '🔸'}</span>
                <p className="text-xs text-slate-300 flex-1 min-w-0 truncate">{m.text}</p>
                <span className={`text-2xs font-mono flex-shrink-0 ${achieved ? 'text-emerald-400' : 'text-indigo-400'}`}>
                  {achieved ? 'Done' : `${m.progress}%`}
                </span>
              </div>
              <div className="h-1 rounded-full bg-surface-border overflow-hidden mt-1 ml-6">
                <div
                  className={`h-full rounded-full transition-all ${achieved ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${m.progress}%` }}
                />
              </div>
              {targetLabel && !achieved && (
                <p className="text-2xs font-mono text-slate-600 mt-0.5 ml-6">by {targetLabel}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreBar({ value, max = 5, color }: { value: number; max?: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div className="h-4 w-1.5 rounded-full bg-surface-border relative overflow-hidden">
      <div
        className={`absolute bottom-0 w-full rounded-full ${color}`}
        style={{ height: `${pct}%` }}
      />
    </div>
  );
}

export function CompletionStreak({ streak }: { streak: number }) {
  if (streak < 1) return null;
  return (
    <div className="rounded-xl bg-surface-2 border border-emerald-500/20 px-4 py-3 flex items-center gap-3">
      <span className="text-2xl">🔥</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-200">
          {streak} session streak
        </p>
        <p className="text-2xs font-mono text-slate-500 mt-0.5">
          {streak === 1 ? 'Keep it going!' : `${streak} sessions completed in a row`}
        </p>
      </div>
    </div>
  );
}

export function WellbeingTrend({ checkins }: { checkins: CheckinData[] }) {
  if (!checkins || checkins.length < 2) return null;

  const reversed = [...checkins].reverse();

  return (
    <div className="rounded-xl bg-surface-2 border border-surface-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-surface-border">
        <p className="text-2xs font-mono text-slate-600 uppercase tracking-widest">
          Wellbeing — last {reversed.length} check-ins
        </p>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-end gap-3 justify-center">
          {reversed.map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="flex items-end gap-0.5">
                <ScoreBar value={c.sleep} color="bg-indigo-400" />
                <ScoreBar value={c.stress} color="bg-amber-400" />
                <ScoreBar value={c.soreness} color="bg-rose-400" />
              </div>
              <span className="text-2xs font-mono text-slate-700">
                {new Date(c.created_at).getDate()}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-surface-border">
          <span className="flex items-center gap-1 text-2xs font-mono text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Sleep
          </span>
          <span className="flex items-center gap-1 text-2xs font-mono text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Stress
          </span>
          <span className="flex items-center gap-1 text-2xs font-mono text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Soreness
          </span>
        </div>
      </div>
    </div>
  );
}
