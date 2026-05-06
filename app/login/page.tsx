'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [mode,     setMode]     = useState<'sign_in' | 'sign_up'>('sign_in');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [sent,     setSent]     = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (mode === 'sign_in') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
      router.push('/');
      router.refresh();
    } else {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/` },
      });
      if (err) { setError(err.message); setLoading(false); return; }
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-3xl">✉</p>
          <h1 className="text-lg font-semibold text-slate-200">Check your email</h1>
          <p className="text-sm text-slate-500 font-mono">
            Confirmation link sent to <span className="text-slate-300">{email}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo / wordmark */}
        <div className="text-center space-y-1">
          <p className="text-2xl font-mono font-bold tracking-tight">
            <span className="text-emerald-400">◈</span>
            <span className="text-amber-400"> ⬡</span>
            <span className="text-indigo-400"> ◎</span>
          </p>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">brigid.pro</h1>
          <p className="text-xs font-mono text-slate-600">tripleaspect.fit</p>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-5">
          <div className="flex rounded-lg overflow-hidden border border-surface-border">
            {(['sign_in', 'sign_up'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === m
                    ? 'bg-surface-4 text-slate-200'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {m === 'sign_in' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label block mb-1">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="label block mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs font-mono text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'sign_in' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                mode === 'sign_in' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-2xs font-mono text-slate-700">
          Precision coaching · Healing · Forging · Verse
        </p>
      </div>
    </div>
  );
}
