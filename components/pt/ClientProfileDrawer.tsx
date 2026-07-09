'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ClientRow, AgreementStatus, AgreementModel,
  OnboardingDocKey, getOnboardingDocs,
} from '@/types/database';
import { STATUS_CONFIG, getInitials, formatCurrency, deletionDaysRemaining, isDeletionOverdue } from '@/lib/utils';
import GdprRemoveModal from '@/components/pt/GdprRemoveModal';

// ─── Types ────────────────────────────────────────────────

type Tab = 'overview' | 'onboarding' | 'billing' | 'sessions';

interface Props {
  client:    ClientRow | null;
  onClose:   () => void;
  onSaved:   (updated: ClientRow) => void;
  onDeleted: (clientId: string) => void;
}

interface FormState {
  status:               AgreementStatus;
  agreement_model:      AgreementModel;
  start_date:           string;
  renewal_date:         string;
  program_length_weeks: string;
  manual_price_numeric: string;
  manual_currency:      string;
  billing_notes:        string;
  goal_text:            string;
  goal_target_date:     string;
  goal_progress:        string;
  parq_signed:          boolean;
  parq_storage_url:     string;
  waiver_signed:        boolean;
  waiver_storage_url:   string;
  consent_signed:       boolean;
  consent_storage_url:  string;
}

// ─── Helpers ──────────────────────────────────────────────

function agreementToForm(client: ClientRow): FormState {
  const a = client.agreement;
  return {
    status:               a.status,
    agreement_model:      a.agreement_model,
    start_date:           a.start_date,
    renewal_date:         a.renewal_date ?? '',
    program_length_weeks: a.program_length_weeks?.toString() ?? '',
    manual_price_numeric: a.manual_price_numeric?.toString() ?? '',
    manual_currency:      a.manual_currency,
    billing_notes:        a.billing_notes ?? '',
    goal_text:            a.goal_text ?? '',
    goal_target_date:     a.goal_target_date ?? '',
    goal_progress:        a.goal_progress?.toString() ?? '',
    parq_signed:          a.parq_signed,
    parq_storage_url:     a.parq_storage_url ?? '',
    waiver_signed:        a.waiver_signed,
    waiver_storage_url:   a.waiver_storage_url ?? '',
    consent_signed:       a.consent_signed,
    consent_storage_url:  a.consent_storage_url ?? '',
  };
}

// ─── Sub-components ───────────────────────────────────────

function DocRow({
  label, signed, url,
  onToggle, onUrlChange,
}: {
  label:       string;
  signed:      boolean;
  url:         string;
  onToggle:    () => void;
  onUrlChange: (v: string) => void;
}) {
  return (
    <div className={`p-3 rounded-lg border transition-colors ${
      signed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-surface-2 border-surface-border'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <button
          type="button"
          onClick={onToggle}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
            signed ? 'bg-emerald-500' : 'bg-surface-4'
          }`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-[left] ${
            signed ? 'left-[22px]' : 'left-0.5'
          }`} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="url"
          placeholder="Paste OneDrive / Google Drive / iCloud URL..."
          value={url}
          onChange={e => onUrlChange(e.target.value)}
          className="input text-2xs font-mono h-8"
        />
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 btn-ghost py-1 px-2 text-xs"
            title="Open document"
          >
            ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Copy Portal Link ─────────────────────────────────────
function CopyPortalLink({ clientId }: { clientId: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(`${window.location.origin}/portal/${clientId}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button
      onClick={handleCopy}
      className={`btn-ghost py-1.5 text-xs px-3 transition-colors ${copied ? 'text-emerald-400' : ''}`}
      title="Copy client portal link"
    >
      {copied ? '✓ Copied' : '⎘ Portal link'}
    </button>
  );
}

// ─── Resend Invite ────────────────────────────────────────
function ResendInvite({ clientId }: { clientId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  async function handleResend() {
    setState('sending');
    const res = await fetch(`/api/clients/${clientId}/resend-invite`, { method: 'POST' });
    setState(res.ok ? 'sent' : 'error');
    if (res.ok) setTimeout(() => setState('idle'), 3000);
  }
  return (
    <button
      onClick={handleResend}
      disabled={state === 'sending' || state === 'sent'}
      className={`btn-ghost py-1.5 text-xs px-3 transition-colors ${
        state === 'sent'  ? 'text-emerald-400' :
        state === 'error' ? 'text-red-400' : ''
      }`}
      title="Resend invite email"
    >
      {state === 'sending' ? (
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin" />
          Sending…
        </span>
      ) : state === 'sent' ? '✓ Invite sent' : state === 'error' ? '✕ Failed' : '↩ Resend invite'}
    </button>
  );
}

// ─── Main Drawer ──────────────────────────────────────────

// ─── Session row type (minimal fetch) ─────────────────────
interface SessionRow {
  id:             string;
  title:          string;
  category:       string;
  scheduled_date: string | null;
  completed_at:   string | null;
  client_notes:   string | null;
}

interface WeekAdherence {
  week_start: string;
  scheduled:  number;
  completed:  number;
  rate:       number;
}

interface CheckinRow {
  id:         string;
  sleep:      number;
  stress:     number;
  soreness:   number;
  notes:      string | null;
  session_id: string | null;
  created_at: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  healing: '◈', forging: '⬡', verse: '◎',
};
const CATEGORY_COLORS: Record<string, string> = {
  healing: 'text-emerald-400', forging: 'text-amber-400', verse: 'text-indigo-400',
};

// ─── Compliance Heatmap ───────────────────────────────────

const HEATMAP_WEEKS = 8;
const HEATMAP_DAYS  = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function ComplianceHeatmap({ sessions, loading }: { sessions: SessionRow[]; loading: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Monday of the current week
  const dow = today.getDay();
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));

  // First Monday of the grid
  const gridStart = new Date(thisMonday);
  gridStart.setDate(thisMonday.getDate() - (HEATMAP_WEEKS - 1) * 7);

  // Index sessions by scheduled_date (YYYY-MM-DD)
  const byDate = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    if (!s.scheduled_date) continue;
    byDate.set(s.scheduled_date, [...(byDate.get(s.scheduled_date) ?? []), s]);
  }

  function cellInfo(dateStr: string): { color: string; tooltip: string } {
    const day = byDate.get(dateStr);
    if (!day?.length) return { color: 'bg-surface-3', tooltip: '' };

    const cellDate = new Date(dateStr + 'T00:00:00');
    const allDone  = day.every(s => !!s.completed_at);
    const someDone = day.some(s  => !!s.completed_at);
    const isFuture = cellDate > today;

    const tooltip = day
      .map(s => `${s.completed_at ? '✓' : isFuture ? '○' : '✗'} ${s.title}`)
      .join(' · ');

    if (allDone)        return { color: 'bg-emerald-500/70', tooltip };
    if (someDone)       return { color: 'bg-emerald-500/35', tooltip };
    if (isFuture)       return { color: 'bg-amber-500/60',   tooltip };
    return               { color: 'bg-red-500/50',            tooltip };
  }

  const weeks = Array.from({ length: HEATMAP_WEEKS }, (_, w) => {
    const monday = new Date(gridStart);
    monday.setDate(gridStart.getDate() + w * 7);
    const label = monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const days = Array.from({ length: 7 }, (_, d) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      return { dateStr, ...cellInfo(dateStr) };
    });
    return { key: monday.toISOString(), label, days };
  });

  return (
    <div>
      {/* Day headers */}
      <div className="flex gap-1 mb-1 pl-[52px]">
        {HEATMAP_DAYS.map((d, i) => (
          <div key={i} className="flex-1 text-center text-2xs font-mono text-slate-600">{d}</div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <span className="w-4 h-4 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-1">
          {weeks.map(({ key, label, days }) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-12 flex-shrink-0 text-right pr-1 text-2xs font-mono text-slate-600">{label}</span>
              {days.map(({ dateStr, color, tooltip }) => (
                <div key={dateStr} className={`flex-1 h-5 rounded-sm ${color} group relative`}>
                  {tooltip && (
                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                      <div className="bg-surface-0 border border-surface-border rounded px-2 py-1 text-2xs font-mono text-slate-300 whitespace-nowrap shadow-lg max-w-52 truncate">
                        {tooltip}
                      </div>
                      <div className="w-1.5 h-1.5 bg-surface-0 border-r border-b border-surface-border rotate-45 -mt-1" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      {!loading && (
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {[
            { color: 'bg-emerald-500/70', label: 'Done'     },
            { color: 'bg-amber-500/60',   label: 'Upcoming' },
            { color: 'bg-red-500/50',     label: 'Missed'   },
            { color: 'bg-surface-3',      label: 'None'     },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1 text-2xs font-mono text-slate-600">
              <span className={`w-2.5 h-2.5 rounded-sm ${color} inline-block`} />
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientProfileDrawer({ client, onClose, onSaved, onDeleted }: Props) {
  const [tab,              setTab]              = useState<Tab>('overview');
  const [form,             setForm]             = useState<FormState | null>(null);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [success,          setSuccess]          = useState(false);
  const [sessions,         setSessions]         = useState<SessionRow[]>([]);
  const [sessionsLoading,  setSessionsLoading]  = useState(false);
  const [deletingId,       setDeletingId]       = useState<string | null>(null);
  const [confirmDelete,    setConfirmDelete]    = useState<string | null>(null);
  const [duplicatingId,    setDuplicatingId]    = useState<string | null>(null);
  const [confirmRemove,    setConfirmRemove]    = useState(false);
  const [removing,         setRemoving]         = useState(false);
  const [showGdprModal,    setShowGdprModal]    = useState(false);
  const [confirmSchedule,  setConfirmSchedule]  = useState(false);
  const [scheduling,       setScheduling]       = useState(false);
  const [scheduleReason,   setScheduleReason]   = useState('');
  const [adherence,          setAdherence]          = useState<WeekAdherence[]>([]);
  const [adherenceLoading,   setAdherenceLoading]   = useState(false);
  const [checkins,           setCheckins]           = useState<CheckinRow[]>([]);
  const [checkinsLoading,    setCheckinsLoading]    = useState(false);
  const [complianceSessions, setComplianceSessions] = useState<SessionRow[]>([]);
  const [complianceLoading,  setComplianceLoading]  = useState(false);

  // Sync form when client changes
  useEffect(() => {
    if (client) {
      setForm(agreementToForm(client));
      setTab('overview');
      setError(null);
      setSuccess(false);
      setSessions([]);
      setAdherence([]);
      setCheckins([]);
      setComplianceSessions([]);
    }
  }, [client]);

  // Fetch sessions when sessions tab opens
  useEffect(() => {
    if (tab === 'sessions' && client && sessions.length === 0 && !sessionsLoading) {
      fetchSessions();
    }
  }, [tab, client]);

  // Fetch adherence + check-ins whenever the overview tab becomes active for a client.
  // Runs on client change (fresh open) and on tab switch back to overview.
  useEffect(() => {
    if (tab === 'overview' && client) {
      fetchAdherence();
      fetchCheckins();
      fetchComplianceSessions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, client?.id]);

  async function fetchAdherence() {
    if (!client) return;
    setAdherenceLoading(true);
    const res = await fetch(`/api/pt/adherence?clientId=${client.id}&weeks=8`);
    const data: WeekAdherence[] = res.ok ? await res.json() : [];
    setAdherence(data);
    setAdherenceLoading(false);
  }

  async function fetchCheckins() {
    if (!client) return;
    setCheckinsLoading(true);
    const res = await fetch(`/api/portal/checkin?clientId=${client.id}`);
    const data: CheckinRow[] = res.ok ? await res.json() : [];
    setCheckins(data);
    setCheckinsLoading(false);
  }

  async function fetchComplianceSessions() {
    if (!client) return;
    setComplianceLoading(true);
    const res = await fetch(`/api/sessions?clientId=${client.id}`);
    const data: SessionRow[] = res.ok ? await res.json() : [];
    setComplianceSessions(data);
    setComplianceLoading(false);
  }

  async function fetchSessions() {
    if (!client) return;
    setSessionsLoading(true);
    const res = await fetch(`/api/sessions?clientId=${client.id}`);
    const data = res.ok ? await res.json() : [];
    setSessions(data);
    setSessionsLoading(false);
  }

  async function handleDeleteSession(sessionId: string) {
    if (confirmDelete !== sessionId) {
      setConfirmDelete(sessionId);
      return;
    }
    setDeletingId(sessionId);
    setConfirmDelete(null);
    const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    setDeletingId(null);
    if (res.ok) setSessions(prev => prev.filter(s => s.id !== sessionId));
  }

  async function handleDuplicateSession(sessionId: string) {
    setDuplicatingId(sessionId);
    const res = await fetch(`/api/sessions/${sessionId}/duplicate`, { method: 'POST' });
    setDuplicatingId(null);
    if (res.ok) {
      const newSession: SessionRow = await res.json();
      setSessions(prev => [newSession, ...prev]);
    }
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(f => f ? { ...f, [key]: val } : f);
  }, []);

  async function handleRemoveClient() {
    if (!client) return;
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setRemoving(true);
    setError(null);
    const res = await fetch(`/api/agreements/${client.agreement.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to remove client');
      setRemoving(false);
      setConfirmRemove(false);
      return;
    }
    onDeleted(client.id);
    onClose();
  }

  async function handleScheduleDeletion() {
    if (!client) return;
    if (!confirmSchedule) { setConfirmSchedule(true); return; }
    setScheduling(true);
    setError(null);
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 14);
    const res = await fetch(`/api/agreements/${client.agreement.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deletion_scheduled_at: deletionDate.toISOString(),
        deletion_reason: scheduleReason || 'Scheduled by PT',
      }),
    });
    setScheduling(false);
    setConfirmSchedule(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to schedule deletion');
      return;
    }
    const updated = await res.json();
    onSaved({ ...client, agreement: { ...client.agreement, ...updated } });
  }

  async function handleCancelDeletion() {
    if (!client) return;
    setError(null);
    const res = await fetch(`/api/agreements/${client.agreement.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletion_scheduled_at: null, deletion_reason: null }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to cancel deletion');
      return;
    }
    const updated = await res.json();
    onSaved({ ...client, agreement: { ...client.agreement, ...updated } });
  }

  async function handleSave() {
    if (!client || !form) return;
    setSaving(true);
    setError(null);

    const payload = {
      status:               form.status,
      agreement_model:      form.agreement_model,
      start_date:           form.start_date || null,
      renewal_date:         form.renewal_date || null,
      program_length_weeks: form.program_length_weeks ? parseInt(form.program_length_weeks) : null,
      manual_price_numeric: form.manual_price_numeric ? parseFloat(form.manual_price_numeric) : null,
      manual_currency:      form.manual_currency,
      billing_notes:        form.billing_notes || null,
      goal_text:            form.goal_text || null,
      goal_target_date:     form.goal_target_date || null,
      ...(form.goal_progress !== '' ? { goal_progress: parseInt(form.goal_progress) } : {}),
      parq_signed:          form.parq_signed,
      parq_storage_url:     form.parq_storage_url || null,
      waiver_signed:        form.waiver_signed,
      waiver_storage_url:   form.waiver_storage_url || null,
      consent_signed:       form.consent_signed,
      consent_storage_url:  form.consent_storage_url || null,
    };

    const res = await fetch(`/api/agreements/${client.agreement.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to save');
      return;
    }

    const updated = await res.json();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);

    onSaved({
      ...client,
      agreement: { ...client.agreement, ...updated } as ClientRow['agreement'],
    });
  }

  if (!client || !form) return null;

  const initials = getInitials(client.full_name);
  const statusCfg = STATUS_CONFIG[form.status];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-surface-1 border-l border-surface-border z-50 flex flex-col animate-slide-in-right shadow-surface">

        {/* ── Header ────────────────────────────────────── */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-surface-border flex-shrink-0">
          <div className="w-11 h-11 rounded-full bg-surface-4 border border-surface-border flex items-center justify-center font-mono font-semibold text-slate-200 text-base flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-100 truncate">
              {client.full_name ?? 'Unnamed Client'}
            </h2>
            <p className="text-2xs font-mono text-slate-500 truncate">{client.email}</p>
          </div>
          <ResendInvite clientId={client?.id ?? ''} />
          <CopyPortalLink clientId={client?.id ?? ''} />
          <Link
            href={`/pt/sessions/builder?clientId=${client?.id}`}
            onClick={onClose}
            className="btn-primary py-1.5 text-xs px-3"
          >
            + Session
          </Link>
          <button onClick={onClose} className="btn-ghost px-2 py-1 text-lg leading-none">×</button>
        </div>

        {/* ── Tabs ──────────────────────────────────────── */}
        <div className="flex items-center gap-0 px-6 pt-4 border-b border-surface-border flex-shrink-0">
          {(['overview', 'sessions', 'onboarding', 'billing'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t === 'sessions' ? 'Sessions' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Scrollable content ────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ═══ OVERVIEW TAB ═══ */}
          {tab === 'overview' && (
            <>
              {/* Status */}
              <div>
                <p className="section-header">Client Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['active', 'attention', 'paused', 'inactive'] as AgreementStatus[]).map(s => {
                    const cfg = STATUS_CONFIG[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => set('status', s)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                          form.status === s
                            ? `${cfg.color} ${cfg.text} border-current/30`
                            : 'bg-surface-2 text-slate-500 border-surface-border hover:border-slate-600'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Agreement model */}
              <div>
                <p className="section-header">Agreement Model</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['subscription', 'fixed_block', 'hybrid'] as AgreementModel[]).map(m => {
                    const labels: Record<AgreementModel, string> = {
                      subscription: 'Subscription',
                      fixed_block:  'Fixed Block',
                      hybrid:       'Hybrid',
                    };
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => set('agreement_model', m)}
                        className={`px-3 py-2 rounded-lg border text-xs font-mono transition-all ${
                          form.agreement_model === m
                            ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                            : 'bg-surface-2 text-slate-500 border-surface-border hover:border-slate-600'
                        }`}
                      >
                        {labels[m]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => set('start_date', e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label block mb-1">Renewal Date</label>
                  <input
                    type="date"
                    value={form.renewal_date}
                    onChange={e => set('renewal_date', e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              {/* Program length (for fixed block) */}
              {(form.agreement_model === 'fixed_block' || form.agreement_model === 'hybrid') && (
                <div>
                  <label className="label block mb-1">Block Length (weeks)</label>
                  <input
                    type="number"
                    min="1" max="52"
                    value={form.program_length_weeks}
                    onChange={e => set('program_length_weeks', e.target.value)}
                    className="input"
                    placeholder="e.g. 12"
                  />
                </div>
              )}

              {/* Client goal */}
              <div>
                <p className="section-header">Client Goal</p>
                <input
                  type="text"
                  value={form.goal_text}
                  onChange={e => set('goal_text', e.target.value)}
                  className="input mb-2"
                  placeholder="e.g. Squat 100kg by summer"
                  maxLength={280}
                />
                <label className="label block mb-1">Target Date (optional)</label>
                <input
                  type="date"
                  value={form.goal_target_date}
                  onChange={e => set('goal_target_date', e.target.value)}
                  className="input mb-3"
                />
                {form.goal_text && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label">Progress</label>
                      <span className={`text-sm font-mono ${form.goal_progress === '100' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                        {form.goal_progress === '100'
                          ? '🎉 Achieved'
                          : form.goal_progress !== '' ? `${form.goal_progress}%` : '—'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0" max="100" step="5"
                      value={form.goal_progress !== '' ? form.goal_progress : '0'}
                      onChange={e => set('goal_progress', e.target.value)}
                      className={`w-full ${form.goal_progress === '100' ? 'accent-emerald-500' : 'accent-indigo-500'}`}
                    />
                    <div className="flex justify-between text-2xs font-mono text-slate-700 mt-0.5">
                      <span>0%</span><span>50%</span><span>100%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sessions summary */}
              <div className="p-4 rounded-lg bg-surface-2 border border-surface-border">
                <p className="section-header">This Week</p>
                <p className="text-2xl font-mono font-bold text-slate-200">{client.sessions_this_week}</p>
                <p className="text-xs font-mono text-slate-600">sessions logged</p>
              </div>

              {/* 8-week adherence chart */}
              <div className="p-4 rounded-lg bg-surface-2 border border-surface-border">
                <div className="flex items-center justify-between mb-3">
                  <p className="section-header mb-0">8-Week Adherence</p>
                  {adherence.length > 0 && (() => {
                    const totalScheduled = adherence.reduce((s, w) => s + w.scheduled, 0);
                    const totalCompleted = adherence.reduce((s, w) => s + w.completed, 0);
                    const overallRate = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : null;
                    return overallRate !== null ? (
                      <span className={`text-sm font-mono font-semibold ${overallRate >= 80 ? 'text-emerald-400' : overallRate >= 50 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {overallRate}%
                      </span>
                    ) : null;
                  })()}
                </div>

                {adherenceLoading && (
                  <div className="flex justify-center py-4">
                    <span className="w-4 h-4 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
                  </div>
                )}

                {!adherenceLoading && adherence.length > 0 && (
                  <div className="flex items-end gap-1 h-10">
                    {adherence.map((w) => {
                      const heightPct = w.scheduled === 0 ? 0 : Math.round((w.completed / w.scheduled) * 100);
                      const weekLabel = new Date(w.week_start + 'T00:00:00Z')
                        .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                      const barColor = w.scheduled === 0
                        ? 'bg-surface-4'
                        : heightPct >= 80 ? 'bg-emerald-500/70' : heightPct >= 50 ? 'bg-amber-500/70' : 'bg-red-500/50';
                      return (
                        <div key={w.week_start} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                          <div className="w-full bg-surface-4 rounded-sm overflow-hidden h-8 flex items-end">
                            <div
                              className={`w-full ${barColor} rounded-sm transition-all`}
                              style={{ height: w.scheduled === 0 ? '4px' : `${Math.max(heightPct, 8)}%` }}
                            />
                          </div>
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                            <div className="bg-surface-0 border border-surface-border rounded px-2 py-1 text-2xs font-mono text-slate-300 whitespace-nowrap shadow-lg">
                              {weekLabel}: {w.completed}/{w.scheduled}
                            </div>
                            <div className="w-1.5 h-1.5 bg-surface-0 border-r border-b border-surface-border rotate-45 -mt-1" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!adherenceLoading && adherence.length === 0 && (
                  <p className="text-xs font-mono text-slate-600 text-center py-3">No session data yet</p>
                )}
              </div>

              {/* Programme compliance heatmap */}
              <div className="p-4 rounded-lg bg-surface-2 border border-surface-border">
                <p className="section-header mb-3">Session Compliance (8 wks)</p>
                <ComplianceHeatmap sessions={complianceSessions} loading={complianceLoading} />
              </div>

              {/* Recent check-ins */}
              <div className="p-4 rounded-lg bg-surface-2 border border-surface-border">
                <p className="section-header mb-3">Recent Check-ins</p>
                {checkinsLoading && (
                  <div className="flex justify-center py-4">
                    <span className="w-4 h-4 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
                  </div>
                )}
                {!checkinsLoading && checkins.length === 0 && (
                  <p className="text-xs font-mono text-slate-600 text-center py-3">No check-ins yet</p>
                )}
                {!checkinsLoading && checkins.length > 0 && (
                  <div className="space-y-2">
                    {checkins.slice(0, 5).map(c => {
                      const scoreColor = (n: number) =>
                        n >= 4 ? 'text-emerald-400' : n === 3 ? 'text-amber-400' : 'text-red-400';
                      const scoreBar = (n: number) =>
                        n >= 4 ? 'bg-emerald-500/60' : n === 3 ? 'bg-amber-500/60' : 'bg-red-500/50';
                      const date = new Date(c.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short',
                      });
                      return (
                        <div key={c.id} className="rounded-lg bg-surface-3 border border-surface-border px-3 py-2.5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-2xs font-mono text-slate-500">{date}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {([['Sleep', c.sleep], ['Stress', c.stress], ['Soreness', c.soreness]] as [string, number][]).map(([label, val]) => (
                              <div key={label} className="text-center">
                                <div className="flex justify-center gap-0.5 mb-1">
                                  {[1,2,3,4,5].map(i => (
                                    <div key={i} className={`w-2.5 h-2.5 rounded-sm ${i <= val ? scoreBar(val) : 'bg-surface-4'}`} />
                                  ))}
                                </div>
                                <span className={`text-2xs font-mono font-semibold ${scoreColor(val)}`}>{val}</span>
                                <span className="text-2xs font-mono text-slate-600"> {label}</span>
                              </div>
                            ))}
                          </div>
                          {c.notes && (
                            <p className="mt-2 text-2xs font-mono text-slate-500 italic border-t border-surface-border pt-1.5">
                              {c.notes}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ SESSIONS TAB ═══ */}
          {tab === 'sessions' && (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="section-header mb-0">Programme Sessions</p>
                <Link
                  href={`/pt/sessions/builder?clientId=${client?.id}`}
                  onClick={onClose}
                  className="text-2xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  + New session →
                </Link>
              </div>

              {sessionsLoading && (
                <div className="py-10 flex justify-center">
                  <span className="w-5 h-5 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
                </div>
              )}

              {!sessionsLoading && sessions.length === 0 && (
                <div className="py-10 text-center text-slate-600 font-mono text-sm">
                  No sessions yet.
                </div>
              )}

              {!sessionsLoading && sessions.length > 0 && (
                <div className="space-y-2">
                  {sessions.map(s => {
                    const icon  = CATEGORY_ICONS[s.category]  ?? '◎';
                    const color = CATEGORY_COLORS[s.category] ?? 'text-slate-400';
                    const isDone = !!s.completed_at;
                    const isConfirming = confirmDelete === s.id;
                    const isDeleting   = deletingId   === s.id;

                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2 border border-surface-border group"
                      >
                        <span className={`text-sm flex-shrink-0 ${color}`}>{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{s.title}</p>
                          <p className="text-2xs font-mono text-slate-600">
                            {s.scheduled_date ?? 'Unscheduled'}
                            {isDone && <span className="ml-2 text-emerald-500">✓ Done</span>}
                          </p>
                          {s.client_notes && (
                            <p className="text-2xs font-mono text-slate-500 italic mt-0.5 truncate">
                              &ldquo;{s.client_notes}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Link
                            href={`/pt/sessions/builder?clientId=${client?.id}&sessionId=${s.id}`}
                            onClick={onClose}
                            className="btn-ghost py-1 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDuplicateSession(s.id)}
                            disabled={duplicatingId === s.id}
                            title="Duplicate session"
                            className="btn-ghost py-1 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-indigo-400"
                          >
                            {duplicatingId === s.id ? '…' : '⎘'}
                          </button>
                          <button
                            onClick={() => handleDeleteSession(s.id)}
                            disabled={isDeleting}
                            className={`py-1 px-2 rounded text-xs font-mono transition-colors opacity-0 group-hover:opacity-100 ${
                              isConfirming
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30 opacity-100'
                                : 'btn-ghost text-slate-600 hover:text-red-400'
                            }`}
                          >
                            {isDeleting ? '…' : isConfirming ? 'Confirm?' : '✕'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ═══ ONBOARDING TAB ═══ */}
          {tab === 'onboarding' && (
            <>
              <div className="p-3 rounded-lg bg-surface-2 border border-surface-border text-xs font-mono text-slate-500 leading-relaxed">
                Toggle each document as signed and paste a direct link to the stored PDF on OneDrive, Google Drive, or iCloud. Links open in a new tab for verification.
              </div>

              <div className="space-y-3">
                <DocRow
                  label="PAR-Q (Physical Activity Readiness)"
                  signed={form.parq_signed}
                  url={form.parq_storage_url}
                  onToggle={() => set('parq_signed', !form.parq_signed)}
                  onUrlChange={v => set('parq_storage_url', v)}
                />
                <DocRow
                  label="Liability Waiver"
                  signed={form.waiver_signed}
                  url={form.waiver_storage_url}
                  onToggle={() => set('waiver_signed', !form.waiver_signed)}
                  onUrlChange={v => set('waiver_storage_url', v)}
                />
                <DocRow
                  label="Informed Consent"
                  signed={form.consent_signed}
                  url={form.consent_storage_url}
                  onToggle={() => set('consent_signed', !form.consent_signed)}
                  onUrlChange={v => set('consent_storage_url', v)}
                />
              </div>

              {/* Compliance score */}
              <div className="flex items-center gap-3">
                {[form.parq_signed, form.waiver_signed, form.consent_signed].map((s, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${s ? 'bg-emerald-400' : 'bg-surface-4'}`} />
                ))}
                <span className="text-2xs font-mono text-slate-500">
                  {[form.parq_signed, form.waiver_signed, form.consent_signed].filter(Boolean).length}/3 complete
                </span>
              </div>
            </>
          )}

          {/* ═══ BILLING TAB ═══ */}
          {tab === 'billing' && (
            <>
              <div className="p-3 rounded-lg bg-surface-2 border border-surface-border text-xs font-mono text-slate-500 leading-relaxed">
                Rate and notes are stored privately for your reference only — never visible to the client.
                Stripe customer and subscription are created automatically when a client is added with a rate set.
              </div>

              <div>
                <label className="label block mb-1">Monthly Rate <span className="normal-case tracking-normal text-slate-600 font-sans font-normal">(optional)</span></label>
                <div className="flex gap-2">
                  <select
                    value={form.manual_currency}
                    onChange={e => set('manual_currency', e.target.value)}
                    className="input w-24 flex-shrink-0"
                  >
                    <option value="GBP">GBP £</option>
                    <option value="USD">USD $</option>
                    <option value="EUR">EUR €</option>
                    <option value="AUD">AUD $</option>
                    <option value="CAD">CAD $</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.manual_price_numeric}
                    onChange={e => set('manual_price_numeric', e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label block mb-1">Billing Notes</label>
                <textarea
                  rows={5}
                  placeholder="Payment method, invoicing instructions, special agreements..."
                  value={form.billing_notes}
                  onChange={e => set('billing_notes', e.target.value)}
                  className="input resize-none"
                />
              </div>

              {/* Stripe info */}
              <div className="p-3 rounded-lg border border-surface-border space-y-2">
                <p className="label">Stripe</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-mono text-slate-600">Customer</p>
                    {client.agreement.stripe_customer_id ? (
                      <a
                        href={`https://dashboard.stripe.com/customers/${client.agreement.stripe_customer_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-2xs font-mono text-indigo-400 hover:underline"
                      >
                        {client.agreement.stripe_customer_id.slice(0, 18)}… ↗
                      </a>
                    ) : (
                      <p className="text-2xs font-mono text-slate-600">Not created yet</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-2xs font-mono text-slate-600">Subscription</p>
                    {client.agreement.stripe_subscription_id ? (
                      <a
                        href={`https://dashboard.stripe.com/subscriptions/${client.agreement.stripe_subscription_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-2xs font-mono text-indigo-400 hover:underline"
                      >
                        {client.agreement.stripe_subscription_id.slice(0, 18)}… ↗
                      </a>
                    ) : (
                      <p className="text-2xs font-mono text-slate-600">—</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-surface-border space-y-3">

          {/* Feedback */}
          {(error || success) && (
            <div>
              {error   && <p className="text-xs font-mono text-red-400">{error}</p>}
              {success && <p className="text-xs font-mono text-emerald-400">✓ Saved successfully</p>}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full justify-center py-2.5"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : 'Save Changes'}
          </button>

          {/* Remove client (soft) */}
          <div className="space-y-1.5">
            <button
              onClick={handleRemoveClient}
              disabled={removing}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
                confirmRemove
                  ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/15'
                  : 'border-surface-border text-slate-500 hover:text-slate-300 hover:border-slate-500'
              }`}
            >
              {removing ? (
                <span className="w-4 h-4 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin" />
              ) : confirmRemove ? (
                'Confirm — remove from client list?'
              ) : (
                'Remove from list'
              )}
            </button>
            {confirmRemove && (
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="w-full text-center text-2xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
              >
                Cancel
              </button>
            )}

            {/* Deletion scheduling */}
            {client.agreement.deletion_scheduled_at ? (
              <div className={`px-3 py-2.5 rounded-lg border text-xs font-mono space-y-1.5 ${
                isDeletionOverdue(client.agreement.deletion_scheduled_at)
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-amber-500/8 border-amber-500/20'
              }`}>
                <p className={isDeletionOverdue(client.agreement.deletion_scheduled_at) ? 'text-red-400' : 'text-amber-400'}>
                  {isDeletionOverdue(client.agreement.deletion_scheduled_at)
                    ? '⚠ Deletion overdue — complete via GDPR erasure below'
                    : `⏰ Deletion scheduled · ${deletionDaysRemaining(client.agreement.deletion_scheduled_at)} day(s) remaining`}
                </p>
                {client.agreement.deletion_reason && (
                  <p className="text-slate-500">{client.agreement.deletion_reason}</p>
                )}
                <button
                  type="button"
                  onClick={handleCancelDeletion}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Cancel scheduled deletion →
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {confirmSchedule && (
                  <input
                    type="text"
                    placeholder="Reason (optional, e.g. client requested)"
                    value={scheduleReason}
                    onChange={e => setScheduleReason(e.target.value)}
                    className="input text-xs"
                  />
                )}
                <button
                  type="button"
                  onClick={handleScheduleDeletion}
                  disabled={scheduling}
                  className={`w-full text-center text-2xs font-mono transition-colors ${
                    confirmSchedule
                      ? 'py-2 rounded-lg border border-amber-500/30 bg-amber-500/8 text-amber-400 hover:bg-amber-500/12'
                      : 'text-slate-600 hover:text-amber-400'
                  }`}
                >
                  {scheduling ? '…' : confirmSchedule ? 'Confirm — schedule deletion in 14 days?' : 'Schedule for deletion (14 days) →'}
                </button>
                {confirmSchedule && (
                  <button
                    type="button"
                    onClick={() => { setConfirmSchedule(false); setScheduleReason(''); }}
                    className="w-full text-center text-2xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGdprModal(true)}
              className="w-full text-center text-2xs font-mono text-slate-600 hover:text-red-400 transition-colors"
            >
              GDPR: Request permanent data erasure →
            </button>
          </div>

        </div>
      </aside>

      {showGdprModal && (
        <GdprRemoveModal
          client={client}
          onClose={() => setShowGdprModal(false)}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}
