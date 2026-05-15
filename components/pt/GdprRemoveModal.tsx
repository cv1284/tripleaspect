'use client';

import { useState } from 'react';
import { ClientRow } from '@/types/database';

interface Props {
  client:    ClientRow;
  onClose:   () => void;
  onDeleted: (clientId: string) => void;
}

type Step = 'info' | 'download' | 'confirm';

export default function GdprRemoveModal({ client, onClose, onDeleted }: Props) {
  const [step,          setStep]          = useState<Step>('info');
  const [reason,        setReason]        = useState('');
  const [confirmName,   setConfirmName]   = useState('');
  const [downloaded,    setDownloaded]    = useState(false);
  const [downloading,   setDownloading]   = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const clientName = client.full_name ?? client.email;
  const nameMatch  = confirmName.trim().toLowerCase() === clientName.toLowerCase();

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${client.id}/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      // Use filename from Content-Disposition if present
      const cd   = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? 'client-data.json';
      a.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!nameMatch) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/clients/${client.id}/gdpr-delete`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Deletion failed');
      setDeleting(false);
      return;
    }
    onDeleted(client.id);
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] animate-fade-in"
        onClick={!deleting ? onClose : undefined}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-surface-2 border border-surface-border rounded-2xl shadow-surface animate-scale-in">

          {/* ── Header ──────────────────────────────────── */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-surface-border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-red-400 text-sm">⚠</span>
                <h2 className="text-base font-semibold text-slate-100">
                  Permanent Data Removal
                </h2>
              </div>
              <p className="text-xs font-mono text-slate-500">GDPR Article 17 — Right to erasure</p>
            </div>
            {!deleting && (
              <button onClick={onClose} className="btn-ghost px-2 py-1 text-lg leading-none">×</button>
            )}
          </div>

          {/* ── Step indicator ──────────────────────────── */}
          <div className="flex items-center gap-0 px-6 pt-4">
            {(['info', 'download', 'confirm'] as Step[]).map((s, i) => {
              const labels = ['Review', 'Export', 'Delete'];
              const active = step === s;
              const done   = (step === 'download' && i === 0) ||
                             (step === 'confirm'  && i <= 1);
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className={`flex items-center gap-1.5 text-xs font-mono transition-colors ${
                    active ? 'text-slate-200' : done ? 'text-emerald-400' : 'text-slate-600'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs border ${
                      active ? 'border-slate-400 bg-surface-4' :
                      done   ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400' :
                               'border-surface-border'
                    }`}>
                      {done ? '✓' : i + 1}
                    </span>
                    {labels[i]}
                  </div>
                  {i < 2 && <div className={`flex-1 h-px mx-2 ${done ? 'bg-emerald-500/30' : 'bg-surface-border'}`} />}
                </div>
              );
            })}
          </div>

          {/* ── Step content ────────────────────────────── */}
          <div className="px-6 py-5 space-y-4">

            {/* STEP 1 — Info */}
            {step === 'info' && (
              <>
                <div className="p-4 rounded-xl bg-red-500/8 border border-red-500/20 space-y-2">
                  <p className="text-sm font-medium text-red-300">This action is irreversible.</p>
                  <p className="text-xs font-mono text-slate-400 leading-relaxed">
                    All data associated with{' '}
                    <span className="text-slate-200 font-semibold">{clientName}</span>{' '}
                    will be permanently deleted from Brigid.pro:
                  </p>
                  <ul className="text-xs font-mono text-slate-500 space-y-1 pl-3">
                    <li>— Account &amp; login credentials</li>
                    <li>— Profile information</li>
                    <li>— All sessions and programme history</li>
                    <li>— Agreement and billing records</li>
                    <li>— Onboarding documents (links only — files on your cloud storage are unaffected)</li>
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-surface-3 border border-surface-border text-xs font-mono text-slate-500 leading-relaxed">
                  On the next step you'll export a JSON backup of their full history. You can email this to the client and re-import it if they ever return.
                </div>

                <button
                  onClick={() => setStep('download')}
                  className="btn-primary w-full justify-center py-2.5"
                >
                  I understand — continue →
                </button>
              </>
            )}

            {/* STEP 2 — Download + Reason */}
            {step === 'download' && (
              <>
                {/* Export */}
                <div>
                  <p className="text-sm font-medium text-slate-200 mb-1">Export client data</p>
                  <p className="text-xs font-mono text-slate-500 mb-3 leading-relaxed">
                    Download a complete JSON record of {clientName}'s history. Email it to the client and keep a copy for your records.
                  </p>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      downloaded
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-surface-border bg-surface-3 text-slate-300 hover:border-slate-500 hover:text-slate-100'
                    }`}
                  >
                    {downloading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin" />
                        Generating export…
                      </>
                    ) : downloaded ? (
                      <>✓ Downloaded — email this to the client</>
                    ) : (
                      <>⬇ Download client data (.json)</>
                    )}
                  </button>
                </div>

                {/* Reason */}
                <div>
                  <label className="label block mb-1">Reason for removal</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Client submitted GDPR erasure request on 07/05/2026"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="input resize-none text-xs"
                  />
                  <p className="text-2xs font-mono text-slate-600 mt-1">
                    This is stored in your export file only — not in the database.
                  </p>
                </div>

                {error && <p className="text-xs font-mono text-red-400">{error}</p>}

                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => setStep('info')} className="btn-ghost flex-1 justify-center">
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep('confirm')}
                    disabled={!downloaded}
                    className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue →
                  </button>
                </div>
                {!downloaded && (
                  <p className="text-2xs font-mono text-slate-600 text-center -mt-2">
                    Download the export first to proceed
                  </p>
                )}
              </>
            )}

            {/* STEP 3 — Confirm by name */}
            {step === 'confirm' && (
              <>
                <div className="p-3 rounded-xl bg-red-500/8 border border-red-500/20 text-xs font-mono text-red-300 leading-relaxed">
                  You are about to permanently delete all data for{' '}
                  <span className="font-semibold text-red-200">{clientName}</span>.
                  This cannot be undone.
                </div>

                <div>
                  <label className="label block mb-1">
                    Type <span className="text-slate-300 normal-case tracking-normal font-mono">{clientName}</span> to confirm
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={confirmName}
                    onChange={e => setConfirmName(e.target.value)}
                    placeholder={clientName}
                    className={`input transition-colors ${
                      confirmName && nameMatch
                        ? 'border-red-500/50 focus:border-red-500'
                        : ''
                    }`}
                  />
                </div>

                {error && <p className="text-xs font-mono text-red-400">{error}</p>}

                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => setStep('download')} className="btn-ghost flex-1 justify-center" disabled={deleting}>
                    ← Back
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={!nameMatch || deleting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                               bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed
                               text-white text-sm font-medium transition-colors"
                  >
                    {deleting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deleting…
                      </>
                    ) : (
                      'Permanently delete'
                    )}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
