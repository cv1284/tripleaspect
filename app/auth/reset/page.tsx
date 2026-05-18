'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [ready,     setReady]     = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // PKCE flow: session is already established by /auth/callback before we land here
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    // Hash flow fallback (legacy email links)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setLoading(false); return; }

    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <p className="text-2xl font-mono font-bold tracking-tight">
            <span className="text-emerald-400">◈</span>
            <span className="text-amber-400"> ⬡</span>
            <span className="text-indigo-400"> ◎</span>
          </p>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">brigid.pro</h1>
        </div>

        <div className="card p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Set a new password</h2>
            {!ready && (
              <p className="text-xs font-mono text-slate-500 mt-1">Verifying reset link…</p>
            )}
          </div>

          {ready && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label block mb-1">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoFocus
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="label block mb-1">Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </div>

              {error && <p className="text-xs font-mono text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating…
                  </span>
                ) : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
