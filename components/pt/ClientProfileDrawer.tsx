'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ClientRow, AgreementStatus, AgreementModel,
  OnboardingDocKey, getOnboardingDocs,
} from '@/types/database';
import { STATUS_CONFIG, getInitials, formatCurrency, deletionDaysRemaining, isDeletionOverdue } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
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
          className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
            signed ? 'bg-emerald-500' : 'bg-surface-4'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            signed ? 'translate-x-5' : 'translate-x-0.5'
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
}

const CATEGORY_ICONS: Record<string, string> = {
  healing: '◈', forging: '⬡', verse: '◎',
};
const CATEGORY_COLORS: Record<string, string> = {
  healing: 'text-emerald-400', forging: 'text-amber-400', verse: 'text-indigo-400',
};

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
  const [confirmRemove,    setConfirmRemove]    = useState(false);
  const [removing,         setRemoving]         = useState(false);
  const [showGdprModal,    setShowGdprModal]    = useState(false);
  const [confirmSchedule,  setConfirmSchedule]  = useState(false);
  const [scheduling,       setScheduling]       = useState(false);
  const [scheduleReason,   setScheduleReason]   = useState('');

  // Sync form when client changes
  useEffect(() => {
    if (client) {
      setForm(agreementToForm(client));
      setTab('overview');
      setError(null);
      setSuccess(false);
      setSessions([]);
    }
  }, [client]);

  // Fetch sessions when sessions tab opens
  useEffect(() => {
    if (tab === 'sessions' && client && sessions.length === 0 && !sessionsLoading) {
      fetchSessions();
    }
  }, [tab, client]);

  async function fetchSessions() {
    if (!client) return;
    setSessionsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('sessions')
      .select('id, title, category, scheduled_date, completed_at')
      .eq('client_id', client.id)
      .order('scheduled_date', { ascending: false });
    setSessions(data ?? []);
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

    const supabase = createClient();
    const payload = {
      status:               form.status,
      agreement_model:      form.agreement_model,
      start_date:           form.start_date || null,
      renewal_date:         form.renewal_date || null,
      program_length_weeks: form.program_length_weeks ? parseInt(form.program_length_weeks) : null,
      manual_price_numeric: form.manual_price_numeric ? parseFloat(form.manual_price_numeric) : null,
      manual_currency:      form.manual_currency,
      billing_notes:        form.billing_notes || null,
      parq_signed:          form.parq_signed,
      parq_storage_url:     form.parq_storage_url || null,
      waiver_signed:        form.waiver_signed,
      waiver_storage_url:   form.waiver_storage_url || null,
      consent_signed:       form.consent_signed,
      consent_storage_url:  form.consent_storage_url || null,
    };

    const { error: err } = await supabase
      .from('client_agreements')
      .update(payload)
      .eq('id', client.agreement.id);

    setSaving(false);

    if (err) { setError(err.message); return; }

    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);

    onSaved({
      ...client,
      agreement: { ...client.agreement, ...payload } as ClientRow['agreement'],
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

              {/* Sessions summary */}
              <div className="p-4 rounded-lg bg-surface-2 border border-surface-border">
                <p className="section-header">This Week</p>
                <p className="text-2xl font-mono font-bold text-slate-200">{client.sessions_this_week}</p>
                <p className="text-xs font-mono text-slate-600">sessions logged</p>
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
                Stored privately for your reference only — never visible to the client.
                Useful for tracking revenue and spotting renewal conversations early.
                Stripe integration available in a future release.
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

              {/* Stripe placeholders */}
              <div className="p-3 rounded-lg border border-dashed border-surface-border">
                <p className="label mb-2">Stripe (Future)</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-2xs font-mono text-slate-600">stripe_customer_id</p>
                    <p className="text-xs font-mono text-slate-500">{client.agreement.stripe_customer_id ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-2xs font-mono text-slate-600">stripe_subscription_id</p>
                    <p className="text-xs font-mono text-slate-500">{client.agreement.stripe_subscription_id ?? '—'}</p>
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
