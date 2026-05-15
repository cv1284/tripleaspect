'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter }    from 'next/navigation';
import { Profile, ClientAgreement } from '@/types/database';

interface Props {
  profile:   Profile;
  clientId:  string;
  agreement: ClientAgreement | null;
}

const DOCS = [
  { key: 'parq',    label: 'PAR-Q',           urlField: 'parq_storage_url'    as const, signedField: 'parq_signed'    as const },
  { key: 'waiver',  label: 'Liability Waiver', urlField: 'waiver_storage_url'  as const, signedField: 'waiver_signed'  as const },
  { key: 'consent', label: 'Informed Consent', urlField: 'consent_storage_url' as const, signedField: 'consent_signed' as const },
];

export default function ClientAccountClient({ profile, clientId, agreement }: Props) {
  const router = useRouter();

  // ── Name ─────────────────────────────────────────────────
  const [name,       setName]       = useState(profile.full_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameMsg,    setNameMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSaveName() {
    if (!name.trim()) return;
    setSavingName(true);
    setNameMsg(null);
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', clientId);
    setSavingName(false);
    setNameMsg(error
      ? { ok: false, text: error.message }
      : { ok: true,  text: 'Name updated.' }
    );
  }

  // ── Documents ─────────────────────────────────────────────
  const [docUrls, setDocUrls] = useState({
    parq_storage_url:    agreement?.parq_storage_url    ?? '',
    waiver_storage_url:  agreement?.waiver_storage_url  ?? '',
    consent_storage_url: agreement?.consent_storage_url ?? '',
  });
  const [savingDocs, setSavingDocs] = useState(false);
  const [docsMsg,    setDocsMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSaveDocs() {
    setSavingDocs(true);
    setDocsMsg(null);
    const res = await fetch('/api/client/docs', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(docUrls),
    });
    setSavingDocs(false);
    if (res.ok) {
      setDocsMsg({ ok: true, text: 'Links saved — your coach will verify and mark them complete.' });
    } else {
      const body = await res.json().catch(() => ({}));
      setDocsMsg({ ok: false, text: body.error ?? 'Failed to save' });
    }
  }

  // ── Password reset ────────────────────────────────────────
  const [sendingReset, setSendingReset] = useState(false);
  const [resetMsg,     setResetMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  async function handlePasswordReset() {
    setSendingReset(true);
    setResetMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${location.origin}/auth/reset`,
    });
    setSendingReset(false);
    setResetMsg(error
      ? { ok: false, text: error.message }
      : { ok: true,  text: `Reset link sent to ${profile.email}` }
    );
  }

  // ── Sign out ──────────────────────────────────────────────
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-6">

      {/* Profile */}
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Profile</h2>
        <div>
          <label className="label block mb-1">Full name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setNameMsg(null); }}
              className="input flex-1"
              placeholder="Your name"
            />
            <button
              onClick={handleSaveName}
              disabled={savingName || name.trim() === (profile.full_name ?? '')}
              className="btn-primary px-4 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingName
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Save'}
            </button>
          </div>
          {nameMsg && (
            <p className={`text-xs font-mono mt-1.5 ${nameMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {nameMsg.text}
            </p>
          )}
        </div>
        <div>
          <label className="label block mb-1">Email</label>
          <input type="email" value={profile.email} disabled className="input opacity-50 cursor-not-allowed" />
          <p className="text-2xs font-mono text-slate-600 mt-1">Contact your coach to update your email address.</p>
        </div>
      </section>

      {/* Onboarding Documents */}
      {agreement && (
        <section className="card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Onboarding Documents</h2>
            <p className="text-xs font-mono text-slate-500 mt-0.5 leading-relaxed">
              Paste a link to each signed document. Your coach will verify and mark it complete.
            </p>
          </div>

          {DOCS.map(doc => {
            const signed = agreement[doc.signedField];
            const urlKey = doc.urlField;
            return (
              <div key={doc.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="label">{doc.label}</label>
                  {signed ? (
                    <span className="text-2xs font-mono text-emerald-400">✓ Verified by coach</span>
                  ) : docUrls[urlKey] ? (
                    <span className="text-2xs font-mono text-amber-400">⏳ Awaiting review</span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={docUrls[urlKey]}
                    onChange={e => setDocUrls(prev => ({ ...prev, [urlKey]: e.target.value }))}
                    placeholder="Paste OneDrive / Google Drive / iCloud link…"
                    disabled={signed}
                    className={`input flex-1 text-xs font-mono ${signed ? 'opacity-60' : ''}`}
                  />
                  {docUrls[urlKey] && (
                    <a href={docUrls[urlKey]} target="_blank" rel="noopener noreferrer"
                       className="btn-ghost px-2 py-1 text-xs flex-shrink-0" title="Open document">
                      ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}

          {docsMsg && (
            <p className={`text-xs font-mono ${docsMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {docsMsg.text}
            </p>
          )}

          <button onClick={handleSaveDocs} disabled={savingDocs} className="btn-primary w-full justify-center py-2.5">
            {savingDocs ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : 'Save document links'}
          </button>
        </section>
      )}

      {/* Security */}
      <section className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Security</h2>
        <p className="text-xs font-mono text-slate-500 leading-relaxed">
          We'll send a password reset link to <span className="text-slate-300">{profile.email}</span>.
        </p>
        <button onClick={handlePasswordReset} disabled={sendingReset}
                className="btn-ghost w-full justify-center py-2.5 text-sm">
          {sendingReset ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin" />
              Sending…
            </span>
          ) : 'Send password reset email'}
        </button>
        {resetMsg && (
          <p className={`text-xs font-mono text-center ${resetMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {resetMsg.text}
          </p>
        )}
      </section>

      {/* Sign out */}
      <section className="card p-5">
        <button onClick={handleSignOut} disabled={signingOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-surface-border text-sm font-medium text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-50">
          {signingOut
            ? <span className="w-4 h-4 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin" />
            : <>→ Sign out</>}
        </button>
      </section>

    </div>
  );
}
