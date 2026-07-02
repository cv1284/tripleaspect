'use client';

import React, { useState } from 'react';
import { Session, ClientAgreement, Profile, SessionCategory } from '@/types/database';
import { CATEGORY_CONFIG } from '@/lib/utils';
import PortalBanners from './PortalBanners';
import ExerciseCard from './ExerciseCard';
import WellbeingCheckin from './WellbeingCheckin';
import { CompletionStreak, WellbeingTrend, ClientGoalCard } from './PortalStats';
import { format, parseISO } from 'date-fns';

interface CheckinData {
  sleep: number;
  stress: number;
  soreness: number;
  created_at: string;
}

interface NextSessionData {
  id:             string;
  title:          string;
  scheduled_date: string | null;
  category:       string;
}

interface Props {
  session:      Session;
  agreement:    ClientAgreement;
  client:       Profile;
  ptEmail?:     string;
  hasCheckin?:  boolean;
  streak?:      number;
  recentCheckins?: CheckinData[];
  nextSession?: NextSessionData | null;
}

// ─── Header ───────────────────────────────────────────────

function SessionHeader({ session }: { session: Session }) {
  const cfg      = CATEGORY_CONFIG[session.category];
  const dateStr  = session.scheduled_date
    ? format(parseISO(session.scheduled_date), 'EEEE, d MMMM yyyy')
    : 'Unscheduled';

  return (
    <div className="space-y-1 mb-6">
      {/* Category pill */}
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium ${cfg.bg} ${cfg.color}`}>
        <span>{cfg.icon}</span> {cfg.label}
      </div>

      <h1 className="text-2xl font-semibold text-slate-100 leading-tight tracking-tight">
        {session.title}
      </h1>
      <p className="text-sm font-mono text-slate-500">{dateStr}</p>

      {session.notes && (
        <p className="text-sm text-slate-400 mt-2 leading-relaxed border-l-2 border-surface-border pl-3">
          {session.notes}
        </p>
      )}
    </div>
  );
}

// ─── Complete Button ──────────────────────────────────────

function CompleteButton({
  sessionId, isCompleted, clientNotes: savedNotes, onComplete,
}: {
  sessionId:    string;
  isCompleted:  boolean;
  clientNotes:  string | null;
  onComplete:   () => void;
}) {
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [notes,         setNotes]         = useState('');
  const [submittedNote, setSubmittedNote] = useState<string | null>(null);

  async function handleComplete() {
    if (isCompleted || loading) return;
    setLoading(true);
    setError(null);
    const trimmed = notes.trim();

    const res = await fetch(`/api/sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: trimmed || undefined }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to record completion');
      return;
    }
    if (trimmed) setSubmittedNote(trimmed);
    onComplete();
  }

  const displayNote = submittedNote ?? savedNotes;

  if (isCompleted) {
    return (
      <div className="space-y-2">
        <div className="w-full py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center gap-3">
          <span className="text-emerald-400 text-xl">✓</span>
          <span className="text-emerald-400 font-semibold text-lg">Session Complete</span>
        </div>
        {displayNote && (
          <p className="text-xs font-mono text-slate-500 italic text-center px-2">&ldquo;{displayNote}&rdquo;</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="How did it feel? (optional)"
        className="w-full bg-surface-2 border border-surface-border rounded-xl px-4 py-3 text-sm text-slate-300 placeholder:text-slate-600 font-mono resize-none focus:outline-none focus:border-indigo-500/50 transition-colors"
      />
      {error && (
        <p className="text-xs font-mono text-red-400 text-center">{error}</p>
      )}
      <button
        onClick={handleComplete}
        disabled={loading}
        className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-lg transition-colors flex items-center justify-center gap-3 shadow-glow-verse disabled:opacity-60"
      >
        {loading ? (
          <>
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Recording...
          </>
        ) : (
          <>
            <span>✓</span>
            Mark Session Complete
          </>
        )}
      </button>
      <p className="text-center text-2xs font-mono text-slate-600">
        Logs your session completion — no tracking required.
      </p>
    </div>
  );
}

// ─── Next Session Card ────────────────────────────────────

function NextSessionCard({ nextSession }: { nextSession: NextSessionData }) {
  const cfg     = CATEGORY_CONFIG[nextSession.category as SessionCategory];
  const dateStr = nextSession.scheduled_date
    ? format(parseISO(nextSession.scheduled_date), 'EEEE, d MMMM')
    : 'Unscheduled';

  return (
    <div className="rounded-xl bg-surface-2 border border-surface-border overflow-hidden">
      <div className="px-4 py-2.5 border-b border-surface-border">
        <p className="text-2xs font-mono text-slate-600 uppercase tracking-widest">Next session</p>
      </div>
      <div className="px-4 py-4 flex items-center gap-3">
        <span className={`text-2xl ${cfg.color}`}>{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-200 truncate">{nextSession.title}</p>
          <p className="text-xs font-mono text-slate-500 mt-0.5">{dateStr}</p>
        </div>
        <span className={`text-2xs font-mono px-2 py-1 rounded-md ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

// ─── Progress Bar ──────────────────────────────────────────

function ProgressBar({ total, expanded }: { total: number; expanded: number }) {
  const pct = total > 0 ? Math.round((expanded / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-mono text-slate-600">Exercises reviewed</span>
        <span className="text-2xs font-mono text-slate-500">{expanded}/{total}</span>
      </div>
      <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────

function EmptySession() {
  return (
    <div className="py-16 text-center space-y-2">
      <p className="text-3xl">◎</p>
      <p className="text-slate-400 font-medium">No exercises in this session yet.</p>
      <p className="text-slate-600 text-sm font-mono">Your coach is still building your programme.</p>
    </div>
  );
}

// ─── No Session State ─────────────────────────────────────

function NoSessionToday({ clientName }: { clientName: string | null }) {
  return (
    <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center p-6 text-center">
      <p className="text-4xl mb-4">◈</p>
      <h1 className="text-xl font-semibold text-slate-200">Rest Day</h1>
      <p className="text-slate-500 font-mono text-sm mt-2">
        No session scheduled for today, {clientName?.split(' ')[0] ?? 'athlete'}.
      </p>
      <p className="text-slate-600 text-xs font-mono mt-1">Recovery is part of the programme.</p>
    </div>
  );
}

// ─── Main Portal View ─────────────────────────────────────

export default function SessionView({ session, agreement, client, ptEmail, hasCheckin, streak, recentCheckins, nextSession }: Props) {
  const [completed,       setCompleted]       = useState(!!session.completed_at);
  const [checkinComplete, setCheckinComplete] = useState(!!hasCheckin);
  const items = session.session_items ?? [];

  if (!session) {
    return <NoSessionToday clientName={client.full_name} />;
  }

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-surface-0/90 backdrop-blur-md border-b border-surface-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-semibold font-mono text-sm tracking-tight">brigid.pro</span>
          </div>
          <div className="text-xs font-mono text-slate-600">
            {client.full_name?.split(' ')[0] ?? 'Athlete'}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-4">

        {/* Priority banners */}
        <PortalBanners agreement={agreement} ptEmail={ptEmail} />

        {/* Stats */}
        {streak !== undefined && <CompletionStreak streak={streak} />}
        <ClientGoalCard goalText={agreement.goal_text} goalTargetDate={agreement.goal_target_date} goalProgress={agreement.goal_progress} />
        {recentCheckins && <WellbeingTrend checkins={recentCheckins} />}

        {/* Pre-session wellbeing check-in — shown only on incomplete sessions */}
        {!completed && !checkinComplete && (
          <WellbeingCheckin
            sessionId={session.id}
            onComplete={() => setCheckinComplete(true)}
          />
        )}

        {/* Session header */}
        <SessionHeader session={session} />

        {/* Exercise list */}
        {items.length === 0 ? (
          <EmptySession />
        ) : (
          <div className="space-y-3">
            {items
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item, idx) => (
                <ExerciseCard
                  key={item.id}
                  item={item}
                  index={idx}
                  category={session.category}
                />
              ))}
          </div>
        )}

        {/* Mark complete — always visible so programme sessions (no items yet) can still be logged */}
        <div className="pt-4">
          <CompleteButton
            sessionId={session.id}
            isCompleted={completed}
            clientNotes={session.client_notes ?? null}
            onComplete={() => setCompleted(true)}
          />
        </div>

        {/* Next session preview — shown after the client completes today's session */}
        {completed && nextSession && (
          <NextSessionCard nextSession={nextSession} />
        )}

        {/* Bottom padding */}
        <div className="h-8" />
      </main>
    </div>
  );
}
