'use client';

import { useState } from 'react';

interface Props {
  sessionId: string;
  onComplete?: () => void;
}

const QUESTIONS = [
  {
    key:     'sleep'    as const,
    label:   'Sleep quality',
    icon:    '🌙',
    low:     'Poor',
    high:    'Great',
  },
  {
    key:     'stress'   as const,
    label:   'Stress level',
    icon:    '⚡',
    low:     'Low',
    high:    'High',
  },
  {
    key:     'soreness' as const,
    label:   'Muscle soreness',
    icon:    '🔥',
    low:     'None',
    high:    'Very sore',
  },
] as const;

type ScoreKey = 'sleep' | 'stress' | 'soreness';

const DOTS = [1, 2, 3, 4, 5] as const;

function ScoreRow({
  question,
  value,
  onChange,
}: {
  question: (typeof QUESTIONS)[number];
  value:    number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{question.icon}</span>
          <span className="text-sm font-medium text-slate-300">{question.label}</span>
        </div>
        {value > 0 && (
          <span className="text-xs font-mono text-slate-500">{value}/5</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-2xs font-mono text-slate-600 w-10 shrink-0">{question.low}</span>
        <div className="flex gap-2 flex-1 justify-center">
          {DOTS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => onChange(d)}
              className={`w-8 h-8 rounded-full border-2 transition-all text-xs font-bold ${
                value === d
                  ? 'border-amber-400 bg-amber-400/20 text-amber-300 scale-110'
                  : value > 0 && d < value
                    ? 'border-amber-400/40 bg-amber-400/10 text-amber-400/60'
                    : 'border-surface-border bg-surface-3 text-slate-600 hover:border-slate-500 hover:text-slate-400'
              }`}
              aria-label={`${question.label} score ${d}`}
            >
              {d}
            </button>
          ))}
        </div>
        <span className="text-2xs font-mono text-slate-600 w-10 shrink-0 text-right">{question.high}</span>
      </div>
    </div>
  );
}

export default function WellbeingCheckin({ sessionId, onComplete }: Props) {
  const [scores,    setScores]    = useState<Record<ScoreKey, number>>({ sleep: 0, stress: 0, soreness: 0 });
  const [notes,     setNotes]     = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [done,      setDone]      = useState(false);

  const allAnswered = Object.values(scores).every(v => v > 0);

  if (dismissed || done) return null;

  async function handleSubmit() {
    if (!allAnswered) { setError('Please rate all three areas before continuing.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/checkin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...scores, notes: notes || null, session_id: sessionId }),
      });
      if (res.status === 409) { setDone(true); onComplete?.(); return; } // already submitted
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Failed to save check-in');
        setSaving(false);
        return;
      }
      setDone(true);
      onComplete?.();
    } catch {
      setError('Network error. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface-2 border border-amber-500/20 overflow-hidden mb-5">
      {/* Header */}
      <div className="px-4 py-3 border-b border-amber-500/15 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-sm">⬡</span>
          <p className="text-xs font-mono text-amber-400 uppercase tracking-widest">Pre-session check-in</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-slate-600 hover:text-slate-400 text-lg leading-none transition-colors"
          aria-label="Dismiss check-in"
        >
          ×
        </button>
      </div>

      <div className="px-4 py-4 space-y-5">
        <p className="text-xs font-mono text-slate-500">
          30 seconds — helps your PT understand how you&apos;re feeling going in.
        </p>

        {QUESTIONS.map(q => (
          <ScoreRow
            key={q.key}
            question={q}
            value={scores[q.key]}
            onChange={v => setScores(prev => ({ ...prev, [q.key]: v }))}
          />
        ))}

        {/* Optional notes */}
        <div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value.slice(0, 500))}
            placeholder="Anything else your PT should know? (optional)"
            rows={2}
            className="w-full bg-surface-3 border border-surface-border rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 font-mono resize-none focus:outline-none focus:border-amber-500/50 transition-colors"
          />
          {notes.length > 400 && (
            <p className="text-2xs font-mono text-slate-600 text-right mt-1">{notes.length}/500</p>
          )}
        </div>

        {error && <p className="text-xs font-mono text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="btn-ghost text-xs px-3 py-2"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !allAnswered}
            className="btn-primary text-xs px-4 py-2 flex-1 disabled:opacity-40"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : 'Submit Check-in'}
          </button>
        </div>
      </div>
    </div>
  );
}
