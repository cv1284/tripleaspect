import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import Link             from 'next/link';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Authenticated users bypass the landing page
  if (user) {
    let { data: profile } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      await supabase.from('profiles').upsert({
        id:    user.id,
        email: user.email!,
        role:  'client',
      });
      profile = { id: user.id, role: 'client' };
    }

    if (profile.role === 'pt')     redirect('/pt/clients');
    if (profile.role === 'client') redirect(`/portal/${user.id}`);
    redirect(`/portal/${user.id}`);
  }

  // Unauthenticated — show landing page
  return <LandingPage />;
}

// ─── Landing Page ─────────────────────────────────────────

function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">

      {/* ── Nav ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <span className="text-xl font-mono font-bold leading-none">
            <span className="text-emerald-400">◈</span>
            <span className="text-amber-400"> ⬡</span>
            <span className="text-indigo-400"> ◎</span>
          </span>
          <span className="text-slate-200 font-semibold tracking-tight">brigid.pro</span>
        </div>
        <Link
          href="/login"
          className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          Sign in →
        </Link>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">

        <div className="max-w-2xl mx-auto space-y-6">

          {/* Aspect icons */}
          <div className="flex items-center justify-center gap-4 text-4xl font-mono font-bold mb-2">
            <span className="text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]">◈</span>
            <span className="text-amber-400  drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]">⬡</span>
            <span className="text-indigo-400 drop-shadow-[0_0_20px_rgba(99,102,241,0.4)]">◎</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 tracking-tight leading-tight">
            Precision coaching.<br />
            <span className="text-slate-500">Three aspects. One programme.</span>
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed max-w-xl mx-auto">
            Brigid.pro is a coaching platform built around the idea that lasting transformation
            requires attention to the body, the body's capacity to perform, and the mind that drives it.
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors shadow-lg"
            >
              Get started
            </Link>
            <a
              href="#aspects"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-600 text-sm font-medium transition-colors"
            >
              Learn more ↓
            </a>
          </div>
        </div>
      </main>

      {/* ── Three Aspects ────────────────────────────────── */}
      <section id="aspects" className="max-w-5xl mx-auto px-6 py-20 w-full">

        <div className="text-center mb-12">
          <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-2">The Triple Aspect Method</p>
          <h2 className="text-2xl font-semibold text-slate-200">Every complete programme addresses all three.</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Healing */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl text-emerald-400">◈</span>
              <div>
                <h3 className="text-base font-semibold text-emerald-300">Healing</h3>
                <p className="text-xs font-mono text-emerald-500/70 uppercase tracking-widest">Restore · Protect · Move</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              The clinical foundation. Injury prevention, corrective exercise, and rehabilitation
              built around how the body actually moves. Every pattern is checked against
              natural biomechanics — so nothing you do in the gym creates problems outside of it.
            </p>
            <ul className="space-y-1.5">
              {['Mobility & joint health', 'Corrective programming', 'Rehab progressions', 'Pain-aware coaching'].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs font-mono text-emerald-400/70">
                  <span className="w-1 h-1 rounded-full bg-emerald-400/50 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Forging */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl text-amber-400">⬡</span>
              <div>
                <h3 className="text-base font-semibold text-amber-300">Forging</h3>
                <p className="text-xs font-mono text-amber-500/70 uppercase tracking-widest">Strength · Performance · Adapt</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Strength and conditioning with structure. Progressive overload, periodisation,
              and performance metrics that actually mean something. Built to make you
              genuinely stronger — not just tired — and to keep adapting long after most programmes plateau.
            </p>
            <ul className="space-y-1.5">
              {['Progressive overload', 'Structured periodisation', 'Metric tracking (RPE, tempo)', 'Sport-specific conditioning'].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs font-mono text-amber-400/70">
                  <span className="w-1 h-1 rounded-full bg-amber-400/50 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Verse */}
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl text-indigo-400">◎</span>
              <div>
                <h3 className="text-base font-semibold text-indigo-300">Verse</h3>
                <p className="text-xs font-mono text-indigo-500/70 uppercase tracking-widest">Habits · Mindset · Lifestyle</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              The connective tissue of a complete programme. Sustainable change doesn't live
              only in the gym — it lives in the decisions made between sessions. Verse addresses
              the habits, patterns, and mindset that determine whether training sticks for a season
              or a lifetime.
            </p>
            <ul className="space-y-1.5">
              {['Habit architecture', 'Sleep & recovery protocols', 'Mindset coaching', 'Lifestyle integration'].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs font-mono text-indigo-400/70">
                  <span className="w-1 h-1 rounded-full bg-indigo-400/50 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

        </div>
      </section>

      {/* ── For Coaches strip ─────────────────────────────── */}
      <section className="border-t border-surface-border">
        <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">Built for coaches</p>
            <h2 className="text-2xl font-semibold text-slate-200 leading-snug">
              Everything your clients need.<br />Everything you need to run it.
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Client directory, session builder, onboarding documents, billing notes,
              and a mobile portal your clients will actually use. No bloat.
              No subscriptions buried inside subscriptions.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
            >
              Start coaching →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '◈', label: 'Client directory',     sub: 'Searchable, sortable, filterable'  },
              { icon: '⬡', label: 'Session builder',      sub: 'Exercises, metrics, YouTube cues'  },
              { icon: '◎', label: 'Client portal',        sub: 'Mobile-first, branded experience'  },
              { icon: '⊕', label: 'Onboarding docs',      sub: 'PAR-Q, waiver, consent tracking'   },
            ].map(f => (
              <div key={f.label} className="p-4 rounded-xl bg-surface-2 border border-surface-border space-y-1.5">
                <span className="text-slate-400 text-lg">{f.icon}</span>
                <p className="text-sm font-medium text-slate-200">{f.label}</p>
                <p className="text-xs font-mono text-slate-600">{f.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-surface-border">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">
              <span className="text-emerald-400">◈</span>
              <span className="text-amber-400"> ⬡</span>
              <span className="text-indigo-400"> ◎</span>
            </span>
            <span className="text-slate-600 text-sm font-mono">tripleaspect.fit</span>
          </div>
          <p className="text-xs font-mono text-slate-700">
            Healing · Forging · Verse
          </p>
        </div>
      </footer>

    </div>
  );
}
