import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase    = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail  = process.env.ADMIN_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) redirect('/login');

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="sticky top-0 z-30 bg-surface-1/95 backdrop-blur-md border-b border-surface-border flex items-center gap-4 px-5 h-12">
        <Link
          href="/pt/clients"
          className="text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5"
        >
          ← Back to dashboard
        </Link>
        <span className="text-slate-700 text-xs">|</span>
        <p className="text-xs font-mono text-slate-500">
          <span className="text-amber-400">⊕</span> Admin
        </p>
      </header>
      {children}
    </div>
  );
}
