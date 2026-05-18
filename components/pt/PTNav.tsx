'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getInitials } from '@/lib/utils';

interface Props {
  profile:  { full_name: string | null; email: string };
  isOwner?: boolean;
}

const NAV_ITEMS = [
  { href: '/pt/clients',  label: 'Clients',  icon: '◧' },
  { href: '/pt/account',  label: 'Account',  icon: '◉' },
] as const;

export default function PTNav({ profile, isOwner }: Props) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initials = getInitials(profile.full_name ?? profile.email);

  return (
    <>
      {/* ── Desktop sidebar (lg+) ──────────────────────── */}
      <nav className="hidden lg:flex w-52 flex-shrink-0 h-full flex-col bg-surface-1 border-r border-surface-border">

        {/* Wordmark */}
        <div className="px-4 py-5 border-b border-surface-border">
          <p className="font-mono font-bold text-sm tracking-tight leading-none">
            <span className="text-emerald-400">◈</span>
            <span className="text-amber-400"> ⬡</span>
            <span className="text-indigo-400"> ◎</span>
            <span className="text-slate-300 ml-2">brigid.pro</span>
          </p>
          <p className="text-2xs font-mono text-slate-700 mt-1">tripleaspect.fit</p>
        </div>

        {/* Nav links */}
        <div className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-surface-4 text-slate-100'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-surface-3'
                }`}
              >
                <span className={`text-base ${active ? 'text-indigo-400' : ''}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        {isOwner && (
          <div className="px-2 pb-2 border-b border-surface-border mb-2">
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith('/admin')
                  ? 'bg-surface-4 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-surface-3'
              }`}
            >
              <span className={`text-base ${pathname.startsWith('/admin') ? 'text-amber-400' : ''}`}>⊕</span>
              Admin
            </Link>
          </div>
        )}

        {/* User identity + sign out */}
        <div className="p-3 border-t border-surface-border space-y-1">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-surface-4 border border-surface-border flex items-center justify-center text-xs font-mono font-semibold text-slate-300 flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">
                {profile.full_name ?? 'PT'}
              </p>
              <p className="text-2xs font-mono text-slate-600 truncate">{profile.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-600 hover:text-slate-400 hover:bg-surface-3 transition-colors"
          >
            <span>→</span> Sign out
          </button>
        </div>
      </nav>

      {/* ── Mobile top header ──────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-surface-1/95 backdrop-blur-md border-b border-surface-border flex items-center justify-between px-4 h-14">
        <p className="font-mono font-bold text-sm tracking-tight leading-none">
          <span className="text-emerald-400">◈</span>
          <span className="text-amber-400"> ⬡</span>
          <span className="text-indigo-400"> ◎</span>
          <span className="text-slate-300 ml-2">brigid.pro</span>
        </p>
        {/* Avatar + sign-out on mobile */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
          title="Sign out"
        >
          <div className="w-7 h-7 rounded-full bg-surface-4 border border-surface-border flex items-center justify-center text-xs font-mono font-semibold text-slate-300">
            {initials}
          </div>
          <span className="text-slate-600">Sign out</span>
        </button>
      </header>

      {/* ── Mobile bottom nav ──────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface-1/95 backdrop-blur-md border-t border-surface-border flex items-stretch safe-area-bottom">
        {NAV_ITEMS.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                active ? 'text-slate-100' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <span className={`text-lg leading-none ${active ? 'text-indigo-400' : ''}`}>
                {item.icon}
              </span>
              <span className={`text-2xs font-mono ${active ? 'text-slate-300' : 'text-slate-600'}`}>
                {item.label}
              </span>
              {active && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-indigo-400 rounded-full" />
              )}
            </Link>
          );
        })}
        {isOwner && (() => {
          const active = pathname.startsWith('/admin');
          return (
            <Link
              href="/admin"
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                active ? 'text-slate-100' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <span className={`text-lg leading-none ${active ? 'text-amber-400' : ''}`}>⊕</span>
              <span className={`text-2xs font-mono ${active ? 'text-slate-300' : 'text-slate-600'}`}>Admin</span>
              {active && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-amber-400 rounded-full" />
              )}
            </Link>
          );
        })()}
      </nav>
    </>
  );
}
