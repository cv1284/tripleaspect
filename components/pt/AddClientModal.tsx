'use client';

import React, { useState } from 'react';
import { AgreementModel, ClientRow } from '@/types/database';
import { isOnboardingComplete } from '@/types/database';
import { daysUntilRenewal } from '@/lib/utils';

interface Props {
  onClose:  () => void;
  onAdded:  (client: ClientRow) => void;
}

interface FormState {
  full_name:            string;
  email:                string;
  agreement_model:      AgreementModel;
  start_date:           string;
  renewal_date:         string;
  program_length_weeks: string;
  manual_price_numeric: string;
  manual_currency:      string;
}

const today = new Date().toISOString().split('T')[0];

const INITIAL: FormState = {
  full_name:            '',
  email:                '',
  agreement_model:      'subscription',
  start_date:           today,
  renewal_date:         '',
  program_length_weeks: '',
  manual_price_numeric: '',
  manual_currency:      'GBP',
};

const MODEL_LABELS: Record<AgreementModel, { label: string; desc: string }> = {
  subscription: { label: 'Subscription',  desc: 'Rolling monthly' },
  fixed_block:  { label: 'Fixed Block',   desc: 'Set programme length' },
  hybrid:       { label: 'Hybrid',        desc: 'Blocks within ongoing' },
};

export default function AddClientModal({ onClose, onAdded }: Props) {
  const [form,        setForm]        = useState<FormState>(INITIAL);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [showPricing, setShowPricing] = useState(false);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email) { setError('Email is required.'); return; }
    setSaving(true);
    setError(null);

    const res = await fetch('/api/clients', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }

    // Build a ClientRow so the directory updates immediately
    const agreement = data.agreement;
    const newClient: ClientRow = {
      id:          data.client_id,
      email:       form.email,
      full_name:   form.full_name || null,
      role:        'client',
      avatar_url:  null,
      created_at:  new Date().toISOString(),
      updated_at:  new Date().toISOString(),
      agreement,
      sessions_this_week:  0,
      days_until_renewal:  daysUntilRenewal(agreement.renewal_date),
      onboarding_complete: isOnboardingComplete(agreement),
    };

    onAdded(newClient);
    onClose();
  }

  const needsDates = form.agreement_model !== 'subscription';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface-2 border border-surface-border rounded-2xl shadow-surface animate-scale-in overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
            <h2 className="font-semibold text-slate-100">Add New Client</h2>
            <button onClick={onClose} className="btn-ghost px-2 text-lg leading-none">×</button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

            {/* Identity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="label block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={form.full_name}
                  onChange={e => set('full_name', e.target.value)}
                  className="input"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label block mb-1">Email <span className="text-red-400">*</span></label>
                <input
                  type="email"
                  required
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {/* Agreement model */}
            <div>
              <label className="label block mb-2">Agreement Model</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(MODEL_LABELS) as [AgreementModel, { label: string; desc: string }][]).map(([m, { label, desc }]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set('agreement_model', m)}
                    className={`px-3 py-2.5 rounded-lg border text-left transition-all ${
                      form.agreement_model === m
                        ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                        : 'bg-surface-3 text-slate-500 border-surface-border hover:border-slate-600'
                    }`}
                  >
                    <p className="text-xs font-medium">{label}</p>
                    <p className="text-2xs font-mono mt-0.5 opacity-70">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  className="input"
                />
              </div>
              {needsDates ? (
                <div>
                  <label className="label block mb-1">Block Length (wks)</label>
                  <input
                    type="number"
                    min="1" max="52"
                    placeholder="12"
                    value={form.program_length_weeks}
                    onChange={e => set('program_length_weeks', e.target.value)}
                    className="input"
                  />
                </div>
              ) : (
                <div>
                  <label className="label block mb-1">Renewal Date</label>
                  <input
                    type="date"
                    value={form.renewal_date}
                    onChange={e => set('renewal_date', e.target.value)}
                    className="input"
                  />
                </div>
              )}
            </div>

            {/* Pricing — optional, collapsed by default */}
            <div className="rounded-lg border border-surface-border overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPricing(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface-3 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="label">Rate</span>
                  <span className="text-2xs font-mono text-slate-600 normal-case tracking-normal">
                    optional
                  </span>
                </div>
                <span className="text-slate-600 text-xs">{showPricing ? '▲' : '▼'}</span>
              </button>

              {showPricing && (
                <div className="px-3 pb-3 pt-1 space-y-2 border-t border-surface-border bg-surface-2/40">
                  <p className="text-2xs font-mono text-slate-600 leading-relaxed">
                    Stored privately for your reference only — shown in the client drawer and on your
                    dashboard. Never visible to the client.
                  </p>
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
              )}
            </div>

            {/* Notice */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-500/8 border border-indigo-500/20 text-indigo-400/80 text-xs font-mono leading-relaxed">
              <span className="flex-shrink-0 mt-0.5">✉</span>
              An invite email will be sent to the client so they can set their password and access their portal.
            </div>

            {error && (
              <p className="text-xs font-mono text-red-400">{error}</p>
            )}
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-surface-border">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button
              onClick={handleSubmit as unknown as React.MouseEventHandler}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending invite...
                </span>
              ) : 'Add Client & Send Invite'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
