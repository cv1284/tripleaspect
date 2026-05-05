'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ClientRow, AgreementStatus, AgreementModel,
  OnboardingDocKey, getOnboardingDocs,
} from '@/types/database';
import { STATUS_CONFIG, getInitials, formatCurrency } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────

type Tab = 'overview' | 'onboarding' | 'billing';

interface Props {
  client:   ClientRow | null;
  onClose:  () => void;
  onSaved:  (updated: ClientRow) => void;
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

// ─── Main Drawer ──────────────────────────────────────────

export default function ClientProfileDrawer({ client, onClose, onSaved }: Props) {
  const [tab,     setTab]     = useState<Tab>('overview');
  const [form,    setForm]    = useState<FormState | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync form when client changes
  useEffect(() => {
    if (client) {
      setForm(agreementToForm(client));
      setTab('overview');
      setError(null);
      setSuccess(false);
    }
  }, [client]);

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
          <button onClick={onClose} className="btn-ghost px-2 py-1 text-lg leading-none">×</button>
        </div>

        {/* ── Tabs ──────────────────────────────────────── */}
        <div className="flex items-center gap-0 px-6 pt-4 border-b border-surface-border flex-shrink-0">
          {(['overview', 'onboarding', 'billing'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t}
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
              <div className="p-3 rounded-lg bg-surface-2 border border-surface-border text-xs font-mono text-slate-500">
                Manual billing — record pricing and notes here. Stripe integration available in a future release.
              </div>

              <div>
                <label className="label block mb-1">Monthly Price</label>
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
        <div className="flex-shrink-0 px-6 py-4 border-t border-surface-border flex items-center justify-between gap-3">
          {error && (
            <p className="text-xs font-mono text-red-400 flex-1 truncate">{error}</p>
          )}
          {success && (
            <p className="text-xs font-mono text-emerald-400 flex-1">✓ Saved successfully</p>
          )}
          {!error && !success && <span className="flex-1" />}

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary min-w-[80px]"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving
                </span>
              ) : 'Save Changes'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
