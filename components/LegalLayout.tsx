import Link from 'next/link';

export function LegalLayout({ title, updated, children }: {
  title:    string;
  updated:  string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">

      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="text-xl font-mono font-bold leading-none">
            <span className="text-emerald-400">◈</span>
            <span className="text-amber-400"> ⬡</span>
            <span className="text-indigo-400"> ◎</span>
          </span>
          <span className="text-slate-200 font-semibold tracking-tight">brigid.pro</span>
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          Sign in →
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-3">brigid.pro</p>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">{title}</h1>
        <p className="text-xs font-mono text-slate-600 mb-12">Last updated: {updated}</p>
        <div className="space-y-10 text-slate-400 text-sm leading-relaxed">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">
              <span className="text-emerald-400">◈</span>
              <span className="text-amber-400"> ⬡</span>
              <span className="text-indigo-400"> ◎</span>
            </span>
            <span className="text-slate-600 text-sm font-mono">tripleaspect.fit</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono text-slate-600">
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</Link>
            <Link href="/terms"   className="hover:text-slate-400 transition-colors">Terms</Link>
            <Link href="/support" className="hover:text-slate-400 transition-colors">Support</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
