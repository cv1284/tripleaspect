'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

// Minimal type for the Turnstile widget API
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback': () => void;
        'error-callback': () => void;
        theme: string;
      }) => string;
      reset: (widgetId: string) => void;
    };
  }
}

export default function PTSignupPage() {
  const [fullName,  setFullName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [cfToken,   setCfToken]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [done,      setDone]      = useState(false);

  const router        = useRouter();
  const containerRef  = useRef<HTMLDivElement>(null);
  const widgetIdRef   = useRef<string | null>(null);

  // Called once the Turnstile script has loaded — renders the widget
  const handleScriptLoad = useCallback(() => {
    if (!window.turnstile || !containerRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey:           process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '',
      callback:          (token) => setCfToken(token),
      'expired-callback': () => setCfToken(''),
      'error-callback':  () => setCfToken(''),
      theme:             'dark',
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (!cfToken) { setError('Please complete the human verification.'); return; }

    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/pt-signup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ full_name: fullName, email, password, cf_token: cfToken }),
    });

    if (!res.ok) {
      const { error: msg } = await res.json();
      setError(msg ?? 'Something went wrong.');
      setLoading(false);
      // Reset Turnstile so they can try again
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setCfToken('');
      }
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-3xl">✉</p>
          <h1 className="text-lg font-semibold text-slate-200">Check your email</h1>
          <p className="text-sm text-slate-500 font-mono leading-relaxed">
            We sent a verification link to <strong className="text-slate-300">{email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="btn-primary px-6 py-2.5"
          >
            Go to sign in →
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Load Turnstile script — onLoad fires after it's ready */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        onLoad={handleScriptLoad}
      />

      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">

          <div className="text-center space-y-1">
            <p className="text-2xl font-mono font-bold tracking-tight">
              <span className="text-emerald-400">◈</span>
              <span className="text-amber-400"> ⬡</span>
              <span className="text-indigo-400"> ◎</span>
            </p>
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">brigid.pro</h1>
            <p className="text-xs font-mono text-slate-600">Create a PT account</p>
          </div>

          <div className="card p-6 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label block mb-1">Full name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="input"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="label block mb-1">Email</label>
                <input
                  type="email"
                  required
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

              {/* Turnstile widget — renders here once script loads */}
              <div ref={containerRef} className="flex justify-center" />

              {error && <p className="text-xs font-mono text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={loading || !cfToken}
                className="btn-primary w-full justify-center py-2.5"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : 'Create PT Account'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs font-mono text-slate-600">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
