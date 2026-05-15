'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  clientId: string;
}

const NAV_ITEMS = [
  {
    id:    'today',
    label: 'Today',
    icon:  '◈',
    href:  (id: string) => `/portal/${id}`,
    exact: true,
  },
  {
    id:    'history',
    label: 'History',
    icon:  '⬡',
    href:  (id: string) => `/portal/${id}/history`,
    exact: false,
  },
  {
    id:    'account',
    label: 'Account',
    icon:  '◎',
    href:  (id: string) => `/portal/${id}/account`,
    exact: false,
  },
];

export default function ClientNav({ clientId }: Props) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-surface-1/95 backdrop-blur-md border-t border-surface-border safe-area-bottom">
      <div className="max-w-lg mx-auto flex items-stretch">
        {NAV_ITEMS.map(item => {
          const href    = item.href(clientId);
          const isActive = item.exact
            ? pathname === href
            : pathname.startsWith(href);

          return (
            <Link
              key={item.id}
              href={href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                isActive
                  ? 'text-slate-100'
                  : 'text-slate-600 hover:text-slate-400'
              }`}
            >
              <span className={`text-lg leading-none ${
                isActive ? 'text-emerald-400' : ''
              }`}>
                {item.icon}
              </span>
              <span className={`text-2xs font-mono ${
                isActive ? 'text-slate-300' : 'text-slate-600'
              }`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-emerald-400 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
