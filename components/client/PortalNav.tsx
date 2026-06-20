'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  clientId: string;
}

const NAV_ITEMS = [
  { label: 'Home',    icon: '⬡', href: (id: string) => `/portal/${id}` },
  { label: 'History', icon: '◉', href: (id: string) => `/portal/${id}/history` },
  { label: 'Photos',  icon: '◈', href: (id: string) => `/portal/${id}/photos` },
  { label: 'Account', icon: '⊞', href: (id: string) => `/portal/${id}/account` },
] as const;

export default function PortalNav({ clientId }: Props) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-surface-1/95 backdrop-blur-md border-t border-surface-border safe-area-pb">
      <div className="max-w-lg mx-auto flex items-stretch">
        {NAV_ITEMS.map(item => {
          const href   = item.href(clientId);
          const isHome = item.label === 'Home';
          const active = isHome ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={item.label}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                active ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-2xs font-mono">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
