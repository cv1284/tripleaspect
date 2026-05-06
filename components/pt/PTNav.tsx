'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getInitials } from '@/lib/utils';

interface Props {
  profile: { full_name: string | null; email: string };
}

const NAV_ITEMS = [
  { href: '/pt/clients',  label: 'Clients',  icon: '◧' },
  { href: '/pt/account',  label: 'Account',  icon: '◉' },
] as const;

export default function PTNav({ profile }: Props) {
  const pathname  = usePathname();
  const router    = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="w-52 flex-shrink-0 h-full flex flex-col bg-surface-1 border-r border-surface-border">

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

      {/* User identity + sign out */}
      <div className="p-3 border-t border-surface-border space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-surface-4 border border-surface-border flex items-center justify-center text-xs font-mono font-semibold text-slate-300 flex-shrink-0">
            {getInitials(profile.full_name ?? profile.email)}
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
  );
}
