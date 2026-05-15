'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';

interface Profile {
  id:         string;
  email:      string;
  full_name:  string | null;
  role:       string;
  created_at: string;
}

interface Props {
  profiles:      Profile[];
  currentUserId: string;
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
  const [profiles, setProfiles] = useState<Profile[]>(initial);
  const [loading,  setLoading]  = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);

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
                <UserRow
                  key={p.id}
                  profile={p}
                  isSelf={p.id === currentUserId}
                  loading={loading === p.id}
                  onSetRole={setRole}
                />
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
                <UserRow
                  key={p.id}
                  profile={p}
                  isSelf={false}
                  loading={loading === p.id}
                  onSetRole={setRole}
                />
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

function UserRow({
  profile, isSelf, loading, onSetRole,
}: {
  profile:   Profile;
  isSelf:    boolean;
  loading:   boolean;
  onSetRole: (id: string, role: 'pt' | 'client') => void;
}) {
  const isCoach = profile.role === 'pt';
  const joined  = format(parseISO(profile.created_at), 'd MMM yyyy');

  return (
    <div className="flex items-center gap-3 px-4 py-3">
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

      {/* Action */}
      {!isSelf && (
        <button
          onClick={() => onSetRole(profile.id, isCoach ? 'client' : 'pt')}
          disabled={loading}
          className={`flex-shrink-0 text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
            isCoach
              ? 'text-slate-500 border-surface-border hover:text-red-400 hover:border-red-500/30'
              : 'text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin inline-block" />
          ) : isCoach ? (
            'Revoke coach'
          ) : (
            'Make coach →'
          )}
        </button>
      )}
    </div>
  );
}
