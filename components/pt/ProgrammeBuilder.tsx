'use client';

import React, { useState, useCallback } from 'react';
import { Programme, ProgrammeWeek, ProgrammeSession, SessionCategory, ClientRow } from '@/types/database';
import { CATEGORY_CONFIG } from '@/lib/utils';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Assign Modal ─────────────────────────────────────────

function AssignModal({
  programmeId,
  clients,
  onClose,
}: {
  programmeId: string;
  clients:     ClientRow[];
  onClose:     () => void;
}) {
  const [clientId,   setClientId]   = useState('');
  const [startDate,  setStartDate]  = useState('');
  const [assigning,  setAssigning]  = useState(false);
  const [result,     setResult]     = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  async function handleAssign() {
    if (!clientId || !startDate) { setError('Select a client and start date.'); return; }
    setAssigning(true);
    setError(null);
    const res = await fetch(`/api/programmes/${programmeId}/assign`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientId, startDate }),
    });
    const data = await res.json();
    setAssigning(false);
    if (!res.ok) { setError(data.error ?? 'Failed to assign.'); return; }
    setResult(`✓ ${data.created} sessions created successfully.`);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface-2 border border-surface-border rounded-2xl shadow-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
            <h3 className="font-semibold text-slate-100">Assign to Client</h3>
            <button onClick={onClose} className="btn-ghost px-2 text-lg leading-none">×</button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {result ? (
              <p className="text-sm font-mono text-emerald-400 py-4 text-center">{result}</p>
            ) : (
              <>
                <div>
                  <label className="label block mb-1">Client</label>
                  <select
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    className="input"
                  >
                    <option value="">Select a client…</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name ?? c.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label block mb-1">Start Date <span className="normal-case font-sans font-normal text-slate-600">(Monday of Week 1)</span></label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="input"
                  />
                </div>

                {error && <p className="text-xs font-mono text-red-400">{error}</p>}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-surface-border">
            <button onClick={onClose} className="btn-ghost text-sm">
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button
                onClick={handleAssign}
                disabled={assigning}
                className="btn-primary text-sm"
              >
                {assigning ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Assigning…
                  </span>
                ) : 'Assign Programme'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Session Slot Editor ──────────────────────────────────

function SessionSlotEditor({
  session,
  weekId,
  dayOfWeek,
  onSave,
  onDelete,
  onClose,
}: {
  session?:   ProgrammeSession;
  weekId:     string;
  dayOfWeek:  number;
  onSave:     (s: ProgrammeSession) => void;
  onDelete?:  () => void;
  onClose:    () => void;
}) {
  const [title,    setTitle]    = useState(session?.title ?? '');
  const [category, setCategory] = useState<SessionCategory>(session?.category ?? 'forging');
  const [notes,    setNotes]    = useState(session?.notes ?? '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError(null);

    if (session?.id) {
      // Update existing — we manage state client-side for now, then persist on programme save
      onSave({ ...session, title: title.trim(), category, notes: notes || null });
    } else {
      onSave({
        id:          `local_${Date.now()}`,
        week_id:     weekId,
        day_of_week: dayOfWeek,
        title:       title.trim(),
        category,
        notes:       notes || null,
        sort_order:  0,
        template_id: null,
        items:       [],
      });
    }
    setSaving(false);
    onClose();
  }

  const cfg = CATEGORY_CONFIG[category];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface-2 border border-surface-border rounded-2xl shadow-surface overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
            <h3 className="font-semibold text-slate-100">
              {session ? 'Edit Session Slot' : `Add Session — ${DAY_LABELS[dayOfWeek - 1]}`}
            </h3>
            <button onClick={onClose} className="btn-ghost px-2 text-lg leading-none">×</button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="label block mb-1">Title</label>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="input"
                placeholder="e.g. Lower Body Strength A"
              />
            </div>

            <div>
              <label className="label block mb-2">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {(['healing', 'forging', 'verse'] as SessionCategory[]).map(c => {
                  const c_cfg = CATEGORY_CONFIG[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                        category === c
                          ? `${c_cfg.bg} ${c_cfg.color} border-current/30`
                          : 'bg-surface-3 text-slate-500 border-surface-border hover:border-slate-600'
                      }`}
                    >
                      <span>{c_cfg.icon}</span> {c_cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label block mb-1">Notes <span className="text-slate-600 normal-case font-sans font-normal text-xs">(optional)</span></label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="input"
                placeholder="Internal coaching notes…"
              />
            </div>

            {error && <p className="text-xs font-mono text-red-400">{error}</p>}
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-surface-border">
            <div>
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="text-xs font-mono text-red-500/70 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`btn-ghost text-sm font-medium ${cfg.color} hover:opacity-80`}
              >
                {saving ? '…' : session ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Programme Builder ─────────────────────────────────────

interface Props {
  programme: Programme;
  clients:   ClientRow[];
}

export default function ProgrammeBuilder({ programme: initial, clients }: Props) {
  const [programme,    setProgramme]    = useState<Programme>(initial);
  const [activeWeek,   setActiveWeek]   = useState(0); // 0-based index
  const [editingSlot,  setEditingSlot]  = useState<{ weekId: string; dayOfWeek: number; session?: ProgrammeSession } | null>(null);
  const [showAssign,   setShowAssign]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState<string | null>(null);

  const weeks = programme.weeks ?? [];
  const currentWeek = weeks[activeWeek] as ProgrammeWeek | undefined;

  const upsertSession = useCallback((weekIdx: number, s: ProgrammeSession) => {
    setProgramme(prev => {
      const nextWeeks = (prev.weeks ?? []).map((w, i) => {
        if (i !== weekIdx) return w;
        const existing = (w.sessions ?? []).find(x => x.id === s.id);
        const sessions = existing
          ? (w.sessions ?? []).map(x => x.id === s.id ? s : x)
          : [...(w.sessions ?? []), s];
        return { ...w, sessions };
      });
      return { ...prev, weeks: nextWeeks };
    });
  }, []);

  const removeSession = useCallback((weekIdx: number, sessionId: string) => {
    setProgramme(prev => {
      const nextWeeks = (prev.weeks ?? []).map((w, i) => {
        if (i !== weekIdx) return w;
        return { ...w, sessions: (w.sessions ?? []).filter(s => s.id !== sessionId) };
      });
      return { ...prev, weeks: nextWeeks };
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveMsg(null);

    const [metaRes, treeRes] = await Promise.all([
      fetch(`/api/programmes/${programme.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:       programme.title,
          description: programme.description,
          category:    programme.category,
          is_public:   programme.is_public,
        }),
      }),
      fetch(`/api/programmes/${programme.id}/save-tree`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          weeks: programme.weeks?.map(w => ({
            id:       w.id,
            sessions: (w.sessions ?? []).map((s, idx) => ({
              day_of_week: s.day_of_week,
              title:       s.title,
              category:    s.category,
              notes:       s.notes ?? null,
              sort_order:  idx,
              template_id: s.template_id ?? null,
            })),
          })) ?? [],
        }),
      }),
    ]);

    setSaving(false);
    setSaveMsg(metaRes.ok && treeRes.ok ? '✓ Saved' : '✕ Save failed');
    setTimeout(() => setSaveMsg(null), 2500);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-28 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={programme.title}
            onChange={e => setProgramme(p => ({ ...p, title: e.target.value }))}
            className="text-xl font-semibold text-slate-100 bg-transparent border-none outline-none w-full focus:ring-1 focus:ring-indigo-500/50 rounded px-1 -ml-1"
            placeholder="Programme title…"
          />
          <p className="text-sm font-mono text-slate-500 mt-0.5">
            {programme.total_weeks} week{programme.total_weeks !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saveMsg && (
            <span className={`text-xs font-mono ${saveMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
              {saveMsg}
            </span>
          )}
          <button
            onClick={() => setShowAssign(true)}
            className="btn-ghost text-sm text-indigo-400 hover:text-indigo-300"
          >
            ↗ Assign to Client
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : 'Save'}
          </button>
        </div>
      </div>

      {/* Week tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {weeks.map((w, i) => (
          <button
            key={w.id}
            onClick={() => setActiveWeek(i)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeWeek === i
                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-surface-3'
            }`}
          >
            {w.label ?? `Week ${w.week_number}`}
          </button>
        ))}
      </div>

      {/* Day grid */}
      {currentWeek && (
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((dayLabel, dayIdx) => {
            const dayOfWeek = dayIdx + 1;
            const daySessions = (currentWeek.sessions ?? [])
              .filter(s => s.day_of_week === dayOfWeek)
              .sort((a, b) => a.sort_order - b.sort_order);

            return (
              <div key={dayLabel} className="space-y-1.5">
                <p className="text-2xs font-mono text-slate-500 text-center uppercase tracking-wider">
                  {dayLabel}
                </p>

                {daySessions.map(session => {
                  const cfg = CATEGORY_CONFIG[session.category];
                  return (
                    <button
                      key={session.id}
                      onClick={() => setEditingSlot({ weekId: currentWeek.id, dayOfWeek, session })}
                      className={`w-full text-left p-2 rounded-lg border transition-all hover:ring-1 hover:ring-indigo-500/40 ${cfg.bg} border-current/20`}
                    >
                      <p className={`text-xs font-medium ${cfg.color} truncate`}>{session.title}</p>
                      <p className={`text-2xs font-mono mt-0.5 opacity-60 ${cfg.color}`}>{cfg.icon} {cfg.label}</p>
                    </button>
                  );
                })}

                {/* Add slot */}
                <button
                  onClick={() => setEditingSlot({ weekId: currentWeek.id, dayOfWeek })}
                  className="w-full py-2 rounded-lg border border-dashed border-surface-border text-slate-700 hover:text-slate-500 hover:border-slate-600 transition-colors text-xs font-mono"
                >
                  +
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Session slot editor */}
      {editingSlot && (
        <SessionSlotEditor
          session={editingSlot.session}
          weekId={editingSlot.weekId}
          dayOfWeek={editingSlot.dayOfWeek}
          onSave={s => upsertSession(activeWeek, s)}
          onDelete={editingSlot.session
            ? () => { removeSession(activeWeek, editingSlot.session!.id); setEditingSlot(null); }
            : undefined}
          onClose={() => setEditingSlot(null)}
        />
      )}

      {/* Assign modal */}
      {showAssign && (
        <AssignModal
          programmeId={programme.id}
          clients={clients}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  );
}
