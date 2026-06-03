'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { getInitials } from '@/lib/utils';

interface Props {
  userId:      string;
  initialName: string;
  email:       string;
  isAdmin:     boolean;
  avatarUrl?:  string | null;
  logoUrl?:    string | null;
}

// ─── Reusable image-upload widget ─────────────────────────

function ImageUpload({
  label,
  hint,
  current,
  uploading,
  saved,
  error,
  shape,
  accept,
  onFileChange,
  onRemove,
}: {
  label:        string;
  hint:         string;
  current:      string | null;
  uploading:    boolean;
  saved:        boolean;
  error:        string | null;
  shape:        'circle' | 'rounded';
  accept:       string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove:     () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';

  return (
    <div>
      <p className="label mb-2">{label}</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`relative w-20 h-20 ${shapeClass} overflow-hidden border-2 border-dashed border-surface-border hover:border-indigo-500/50 transition-colors flex-shrink-0 group`}
        >
          {current ? (
            <Image src={current} alt={label} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full bg-surface-3 flex items-center justify-center">
              <span className="text-xl text-slate-600 group-hover:text-indigo-400 transition-colors">+</span>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {!uploading && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <span className="text-white text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">Upload</span>
            </div>
          )}
        </button>

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="btn-ghost text-xs border border-surface-border"
          >
            {current ? 'Replace' : 'Upload'}
          </button>
          {current && (
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="block text-xs font-mono text-slate-600 hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          )}
          <p className="text-2xs font-mono text-slate-600">{hint}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onFileChange}
        className="hidden"
      />

      {error  && <p className="text-xs font-mono text-red-400 mt-2">{error}</p>}
      {saved  && <p className="text-xs font-mono text-emerald-400 mt-2">✓ Saved</p>}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────

export default function AccountClient({
  userId, initialName, email, isAdmin, avatarUrl, logoUrl,
}: Props) {
  const [name,           setName]           = useState(initialName);
  const [saving,         setSaving]         = useState(false);
  const [nameSaved,      setNameSaved]      = useState(false);
  const [nameError,      setNameError]      = useState<string | null>(null);
  const [resetSent,      setResetSent]      = useState(false);
  const [resetError,     setResetError]     = useState<string | null>(null);

  const [currentAvatar,  setCurrentAvatar]  = useState<string | null>(avatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarSaved,    setAvatarSaved]    = useState(false);
  const [avatarError,    setAvatarError]    = useState<string | null>(null);

  const [currentLogo,    setCurrentLogo]    = useState<string | null>(logoUrl ?? null);
  const [logoUploading,  setLogoUploading]  = useState(false);
  const [logoSaved,      setLogoSaved]      = useState(false);
  const [logoError,      setLogoError]      = useState<string | null>(null);

  const initials = getInitials(name || email);

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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError(null);
    setAvatarSaved(false);
    const form = new FormData();
    form.append('avatar', file);
    const res = await fetch('/api/pt/avatar', { method: 'POST', body: form });
    const data = await res.json();
    setAvatarUploading(false);
    if (!res.ok) { setAvatarError(data.error ?? 'Upload failed'); return; }
    setCurrentAvatar(data.url);
    setAvatarSaved(true);
    setTimeout(() => setAvatarSaved(false), 2500);
    e.target.value = '';
  }

  async function handleAvatarRemove() {
    setAvatarUploading(true);
    setAvatarError(null);
    const res = await fetch('/api/pt/avatar', { method: 'DELETE' });
    setAvatarUploading(false);
    if (!res.ok) { const d = await res.json(); setAvatarError(d.error ?? 'Failed to remove'); return; }
    setCurrentAvatar(null);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setLogoError(null);
    setLogoSaved(false);
    const form = new FormData();
    form.append('logo', file);
    const res = await fetch('/api/pt/logo', { method: 'POST', body: form });
    const data = await res.json();
    setLogoUploading(false);
    if (!res.ok) { setLogoError(data.error ?? 'Upload failed'); return; }
    setCurrentLogo(data.url);
    setLogoSaved(true);
    setTimeout(() => setLogoSaved(false), 2500);
    e.target.value = '';
  }

  async function handleLogoRemove() {
    setLogoUploading(true);
    setLogoError(null);
    const res = await fetch('/api/pt/logo', { method: 'DELETE' });
    setLogoUploading(false);
    if (!res.ok) { const d = await res.json(); setLogoError(d.error ?? 'Failed to remove'); return; }
    setCurrentLogo(null);
  }

  return (
    <div className="space-y-5">

      {/* Profile */}
      <div className="card p-5 space-y-5">
        <p className="section-header">Profile</p>

        {/* Avatar — personal photo, shown in the nav */}
        <div className="pb-4 border-b border-surface-border">
          <ImageUpload
            label="Profile Photo"
            hint="Your face — shown in the sidebar nav. JPEG, PNG or WebP · max 5 MB"
            current={currentAvatar}
            uploading={avatarUploading}
            saved={avatarSaved}
            error={avatarError}
            shape="circle"
            accept="image/jpeg,image/png,image/webp"
            onFileChange={handleAvatarChange}
            onRemove={handleAvatarRemove}
          />
          {/* Initials fallback preview */}
          {!currentAvatar && (
            <p className="text-2xs font-mono text-slate-700 mt-2">
              No photo set — the nav shows <span className="text-slate-500">{initials}</span> as initials.
            </p>
          )}
        </div>

        {/* Name + email */}
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

        {nameError && <p className="text-xs font-mono text-red-400">{nameError}</p>}
        {nameSaved && <p className="text-xs font-mono text-emerald-400">✓ Name updated</p>}

        <button onClick={handleSaveName} disabled={saving} className="btn-primary">
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </span>
          ) : 'Save Name'}
        </button>
      </div>

      {/* Brand Logo */}
      <div className="card p-5 space-y-3">
        <div>
          <p className="section-header">Brand Logo</p>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            Your business mark — appears on public session templates you share with other PTs.
          </p>
        </div>
        <ImageUpload
          label="Logo / Brand Mark"
          hint="PNG, JPG or WebP · max 2 MB · square or landscape works best"
          current={currentLogo}
          uploading={logoUploading}
          saved={logoSaved}
          error={logoError}
          shape="rounded"
          accept="image/jpeg,image/png,image/webp"
          onFileChange={handleLogoChange}
          onRemove={handleLogoRemove}
        />
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
          We&apos;ll send a reset link to <span className="text-slate-300 font-mono">{email}</span>.
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
