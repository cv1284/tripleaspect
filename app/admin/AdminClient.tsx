'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';

interface Profile {
  id:                 string;
  email:              string;
  full_name:          string | null;
  role:               string;
  created_at:         string;
  free_client_quota:  number;
  client_count:       number;
}

interface Props {
  profiles:      Profile[];
  currentUserId: string;
}

// ─── Inline GDPR delete panel ─────────────────────────────

function DeletePanel({
  profile,
  onDeleted,
  onCancel,
}: {
  profile:   Profile;
  onDeleted: (id: string) => void;
  onCancel:  () => void;
}) {
  const [confirmInput, setConfirmInput] = useState('');
  const [downloading,  setDownloading]  = useState(false);
  const [downloaded,   setDownloaded]   = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const displayName = profile.full_name ?? profile.email;
  const confirmed   = confirmInput.trim().toLowerCase() === profile.email.toLowerCase();

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/delete-user/${profile.id}`);
      if (!res.ok) throw new Error('Export failed');
      const blob  = URL.createObjectURL(await res.blob());
      const a     = document.createElement('a');
      const cd    = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      a.href     = blob;
      a.download = match?.[1] ?? 'user-data.json';
      a.click();
      URL.revokeObjectURL(blob);
      setDownloaded(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/admin/delete-user/${profile.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Deletion failed');
      setDeleting(false);
      return;
    }
    onDeleted(profile.id);
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      <div className="p-3 rounded-lg bg-red-500/8 border border-red-500/20 space-y-1.5">
        <p className="text-xs font-semibold text-red-300">Permanent data erasure — GDPR Art. 17</p>
        <p className="text-xs font-mono text-slate-400 leading-relaxed">
          All data for <span className="text-slate-200 font-semibold">{displayName}</span> will be
          permanently deleted: account, profile, sessions, agreements. This cannot be undone.
        </p>
      </div>

      {/* Export */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
          downloaded
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-surface-border bg-surface-3 text-slate-300 hover:border-slate-500'
        }`}
      >
        {downloading ? (
          <><span className="w-3 h-3 border-2 border-slate-500 border-t-slate-200 rounded-full animate-spin" /> Exporting…</>
        ) : downloaded ? (
          '✓ Downloaded — keep a copy'
        ) : (
          '⬇ Export data first (recommended)'
        )}
      </button>

      {/* Confirm by email */}
      <div>
        <label className="text-2xs font-mono text-slate-500 block mb-1.5">
          Type <span className="text-slate-300">{profile.email}</span> to confirm
        </label>
        <input
          type="text"
          autoFocus
          value={confirmInput}
          onChange={e => setConfirmInput(e.target.value)}
          placeholder={profile.email}
          className={`w-full bg-surface-1 border rounded-lg px-3 py-2 text-sm font-mono text-slate-200 outline-none transition-colors ${
            confirmInput && confirmed
              ? 'border-red-500/50 focus:border-red-500'
              : 'border-surface-border focus:border-slate-500'
          }`}
        />
      </div>

      {error && <p className="text-xs font-mono text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={deleting}
          className="flex-1 px-3 py-2 rounded-lg border border-surface-border text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={!confirmed || deleting}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-mono font-semibold transition-colors"
        >
          {deleting ? (
            <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting…</>
          ) : (
            'Permanently delete'
          )}
        </button>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return role === 'pt' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-mono bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
      ◉ PT
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-mono bg-surface-3 text-slate-500 border border-surface-border">
      ◌ Client
    </span>
  );
}

export default function AdminClient({ profiles: initial, currentUserId }: Props) {
  const [profiles,       setProfiles]       = useState<Profile[]>(initial);
  const [loading,        setLoading]        = useState<string | null>(null);
  const [error,          setError]          = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [quotaSaving,    setQuotaSaving]    = useState<string | null>(null);
  const [quotaErrors,    setQuotaErrors]    = useState<Record<string, string>>({});

  function updateQuotaLocal(ptId: string, raw: string) {
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 0) return;
    setProfiles(prev => prev.map(p => p.id === ptId ? { ...p, free_client_quota: val } : p));
  }

  async function saveQuota(ptId: string, quota: number) {
    setQuotaSaving(ptId);
    setQuotaErrors(prev => { const n = { ...prev }; delete n[ptId]; return n; });
    const res = await fetch(`/api/admin/pts/${ptId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ free_client_quota: quota }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setQuotaErrors(prev => ({ ...prev, [ptId]: body.error ?? 'Save failed' }));
    }
    setQuotaSaving(null);
  }

  function handleDeleted(userId: string) {
    setProfiles(prev => prev.filter(p => p.id !== userId));
    setDeletingUserId(null);
  }

  async function setRole(userId: string, role: 'pt' | 'client') {
    setLoading(userId);
    setError(null);

    const res = await fetch('/api/admin/set-role', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, role }),
    });

    setLoading(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to update role');
      return;
    }

    setProfiles(prev =>
      prev.map(p => p.id === userId ? { ...p, role } : p)
    );
  }

  const pts     = profiles.filter(p => p.role === 'pt');
  const clients = profiles.filter(p => p.role === 'client');

  return (
    <div className="min-h-screen bg-surface-0 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-base">
              <span className="text-emerald-400">◈</span>
              <span className="text-amber-400"> ⬡</span>
              <span className="text-indigo-400"> ◎</span>
            </span>
            <h1 className="text-lg font-semibold text-slate-100">Admin Panel</h1>
          </div>
          <p className="text-xs font-mono text-slate-600">
            {pts.length} coach{pts.length !== 1 ? 'es' : ''} · {clients.length} client{clients.length !== 1 ? 's' : ''} · {profiles.length} total accounts
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
            {error}
          </div>
        )}

        {/* Coaches */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-300">Coaches</h2>
            <span className="text-2xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              {pts.length}
            </span>
          </div>
          <div className="card overflow-hidden divide-y divide-surface-border">
            {pts.length === 0 ? (
              <p className="px-4 py-8 text-center text-slate-600 font-mono text-sm">No coaches yet.</p>
            ) : (
              pts.map(p => (
                <div key={p.id}>
                  <UserRow
                    profile={p}
                    isSelf={p.id === currentUserId}
                    loading={loading === p.id}
                    showingDelete={deletingUserId === p.id}
                    quotaSaving={quotaSaving === p.id}
                    quotaError={quotaErrors[p.id]}
                    onSetRole={setRole}
                    onDeleteClick={() => setDeletingUserId(deletingUserId === p.id ? null : p.id)}
                    onQuotaChange={val => updateQuotaLocal(p.id, val)}
                    onQuotaSave={quota => saveQuota(p.id, quota)}
                  />
                  {deletingUserId === p.id && (
                    <DeletePanel
                      profile={p}
                      onDeleted={handleDeleted}
                      onCancel={() => setDeletingUserId(null)}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Clients / pending */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-300">Client Accounts</h2>
            <span className="text-2xs font-mono text-slate-500 bg-surface-3 px-2 py-0.5 rounded border border-surface-border">
              {clients.length}
            </span>
            <span className="text-2xs font-mono text-slate-600">— promote to grant coach access</span>
          </div>
          <div className="card overflow-hidden divide-y divide-surface-border">
            {clients.length === 0 ? (
              <p className="px-4 py-8 text-center text-slate-600 font-mono text-sm">No client accounts.</p>
            ) : (
              clients.map(p => (
                <div key={p.id}>
                  <UserRow
                    profile={p}
                    isSelf={false}
                    loading={loading === p.id}
                    showingDelete={deletingUserId === p.id}
                    onSetRole={setRole}
                    onDeleteClick={() => setDeletingUserId(deletingUserId === p.id ? null : p.id)}
                  />
                  {deletingUserId === p.id && (
                    <DeletePanel
                      profile={p}
                      onDeleted={handleDeleted}
                      onCancel={() => setDeletingUserId(null)}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

function UserRow({
  profile, isSelf, loading, showingDelete, quotaSaving, quotaError,
  onSetRole, onDeleteClick, onQuotaChange, onQuotaSave,
}: {
  profile:        Profile;
  isSelf:         boolean;
  loading:        boolean;
  showingDelete:  boolean;
  quotaSaving?:   boolean;
  quotaError?:    string;
  onSetRole:      (id: string, role: 'pt' | 'client') => void;
  onDeleteClick:  () => void;
  onQuotaChange?: (val: string) => void;
  onQuotaSave?:   (quota: number) => void;
}) {
  const isCoach = profile.role === 'pt';
  const joined  = format(parseISO(profile.created_at), 'd MMM yyyy');

  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${showingDelete ? 'bg-red-500/5' : ''}`}>
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-surface-4 border border-surface-border flex items-center justify-center text-xs font-mono font-semibold text-slate-300 flex-shrink-0">
        {(profile.full_name ?? profile.email).slice(0, 2).toUpperCase()}
      </div>

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-200 truncate">
            {profile.full_name ?? <span className="text-slate-500">Unnamed</span>}
          </p>
          <RoleBadge role={profile.role} />
          {isSelf && (
            <span className="text-2xs font-mono text-emerald-500">you</span>
          )}
        </div>
        <p className="text-2xs font-mono text-slate-600 truncate">{profile.email}</p>
        <p className="text-2xs font-mono text-slate-700">Joined {joined}</p>
      </div>

      {/* Quota editor — PT rows only */}
      {isCoach && onQuotaChange && onQuotaSave && (
        <div className="flex flex-col items-center flex-shrink-0">
          <p className="text-2xs font-mono text-slate-600 mb-1">
            {profile.client_count} / quota
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              value={profile.free_client_quota}
              onChange={e => onQuotaChange(e.target.value)}
              onBlur={e => onQuotaSave(parseInt(e.target.value, 10))}
              className="w-14 text-center bg-surface-1 border border-surface-border rounded-lg px-1.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {quotaSaving && (
              <span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            )}
          </div>
          {quotaError && (
            <p className="text-2xs font-mono text-red-400 mt-0.5">{quotaError}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!isSelf && (
          <>
            <button
              onClick={() => onSetRole(profile.id, isCoach ? 'client' : 'pt')}
              disabled={loading}
              className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                isCoach
                  ? 'text-slate-500 border-surface-border hover:text-red-400 hover:border-red-500/30'
                  : 'text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block" />
              ) : isCoach ? 'Revoke coach' : 'Make coach →'}
            </button>
            <button
              onClick={onDeleteClick}
              className={`text-xs font-mono px-2.5 py-1.5 rounded-lg border transition-colors ${
                showingDelete
                  ? 'bg-red-500/15 text-red-400 border-red-500/30'
                  : 'text-slate-600 border-surface-border hover:text-red-400 hover:border-red-500/30'
              }`}
              title="GDPR: permanently delete this account"
            >
              {showingDelete ? '✕ Cancel' : '⊗ Delete'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
