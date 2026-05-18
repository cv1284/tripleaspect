'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  userId:      string;
  initialName: string;
  email:       string;
  isAdmin:     boolean;
}

export default function AccountClient({ userId, initialName, email, isAdmin }: Props) {
  const [name,         setName]         = useState(initialName);
  const [saving,       setSaving]       = useState(false);
  const [nameSaved,    setNameSaved]    = useState(false);
  const [nameError,    setNameError]    = useState<string | null>(null);
  const [resetSent,    setResetSent]    = useState(false);
  const [resetError,   setResetError]   = useState<string | null>(null);

  async function handleSaveName() {
    setSaving(true);
    setNameError(null);
    setNameSaved(false);

    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() || null })
      .eq('id', userId);

    setSaving(false);
    if (error) { setNameError(error.message); return; }
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2500);
  }

  async function handlePasswordReset() {
    setResetError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/pt/account`,
    });
    if (error) { setResetError(error.message); return; }
    setResetSent(true);
  }

  return (
    <div className="space-y-5">

      {/* Profile */}
      <div className="card p-5 space-y-4">
        <p className="section-header">Profile</p>

        <div>
          <label className="label block mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            className="input"
          />
        </div>

        <div>
          <label className="label block mb-1">Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="input opacity-50 cursor-not-allowed"
          />
          <p className="text-2xs font-mono text-slate-600 mt-1">Email cannot be changed here.</p>
        </div>

        {nameError  && <p className="text-xs font-mono text-red-400">{nameError}</p>}
        {nameSaved  && <p className="text-xs font-mono text-emerald-400">✓ Name updated</p>}

        <button
          onClick={handleSaveName}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </span>
          ) : 'Save Name'}
        </button>
      </div>

      {/* Admin panel link */}
      {isAdmin && (
        <a
          href="/admin"
          className="card p-5 flex items-center justify-between group hover:border-indigo-500/30 transition-colors"
        >
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-0.5">Admin Panel</p>
            <p className="text-xs font-mono text-slate-500">Manage coaches, accounts &amp; roles</p>
          </div>
          <span className="text-slate-600 group-hover:text-indigo-400 transition-colors text-lg">→</span>
        </a>
      )}

      {/* Password */}
      <div className="card p-5 space-y-3">
        <p className="section-header">Password</p>
        <p className="text-sm text-slate-500">
          We'll send a password reset link to <span className="text-slate-300 font-mono">{email}</span>.
        </p>
        {resetError && <p className="text-xs font-mono text-red-400">{resetError}</p>}
        {resetSent ? (
          <p className="text-xs font-mono text-emerald-400">✓ Reset link sent — check your inbox.</p>
        ) : (
          <button onClick={handlePasswordReset} className="btn-ghost border border-surface-border">
            Send Password Reset Email
          </button>
        )}
      </div>
    </div>
  );
}
