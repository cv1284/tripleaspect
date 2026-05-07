'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Mode = 'sign_in' | 'sign_up' | 'forgot' | 'resend';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [mode,     setMode]     = useState<Mode>('sign_in');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [sent,     setSent]     = useState(false);
  const router = useRouter();

  // Parse error hash params that Supabase appends on link failures
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = hash.get('error_code');
    if (code === 'otp_expired' || code === 'otp_disabled') {
      setError('Your confirmation link has expired. Enter your email below to get a new one.');
      setMode('resend');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setPassword('');
    setSent(false);
  }

  async function handleResend() {
    if (!email) { setError('Enter your email address first.'); return; }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resend({ type: 'signup', email });
    if (err) { setError(err.message); setLoading(false); return; }
    setSent(true);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    if (mode === 'forgot') {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/reset`,
      });
      if (err) { setError(err.message); setLoading(false); return; }
      setSent(true);
      setLoading(false);
      return;
    }

    if (mode === 'sign_in') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        const msg = err.message.toLowerCase().includes('invalid')
          ? 'Invalid email or password. If you just signed up, check your email for a confirmation link first.'
          : err.message;
        setError(msg);
        setLoading(false);
        return;
      }
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
          <h1 className="text-lg font-semibold text-slate-200">
            {mode === 'forgot' ? 'Reset link sent' : 'Check your email'}
          </h1>
          <p className="text-sm text-slate-500 font-mono">
            {mode === 'forgot'
              ? <>Password reset link sent to <span className="text-slate-300">{email}</span>.</>
              : <>New confirmation link sent to <span className="text-slate-300">{email}</span>. Click it then sign in.</>
            }
          </p>
          <button
            onClick={() => switchMode('sign_in')}
            className="text-xs font-mono text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
          >
            Back to sign in
          </button>
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

          {mode !== 'forgot' && mode !== 'resend' && (
            <div className="flex rounded-lg overflow-hidden border border-surface-border">
              {(['sign_in', 'sign_up'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
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
          )}

          {mode === 'forgot' && (
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Reset password</h2>
              <p className="text-xs font-mono text-slate-500 mt-0.5">We'll email you a reset link.</p>
            </div>
          )}

          {mode === 'resend' && (
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Resend confirmation</h2>
              <p className="text-xs font-mono text-slate-500 mt-0.5">We'll send a fresh confirmation link.</p>
            </div>
          )}

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

            {mode !== 'forgot' && mode !== 'resend' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label">Password</label>
                  {mode === 'sign_in' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-2xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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
            )}

            {error && (
              <p className="text-xs font-mono text-red-400">{error}</p>
            )}

            {mode === 'resend' ? (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </span>
                ) : 'Resend Confirmation Email'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {mode === 'sign_in' ? 'Signing in...' : mode === 'sign_up' ? 'Creating account...' : 'Sending...'}
                  </span>
                ) : (
                  mode === 'sign_in' ? 'Sign In' : mode === 'sign_up' ? 'Create Account' : 'Send Reset Link'
                )}
              </button>
            )}

            {(mode === 'forgot' || mode === 'resend') && (
              <button
                type="button"
                onClick={() => switchMode('sign_in')}
                className="w-full text-center text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
              >
                ← Back to sign in
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-2xs font-mono text-slate-700">
          Precision coaching · Healing · Forging · Verse
        </p>
      </div>
    </div>
  );
}
