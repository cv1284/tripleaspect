import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PTNav from '@/components/pt/PTNav';

export default async function PTLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'pt') redirect('/login');

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <PTNav profile={{ full_name: profile.full_name, email: profile.email }} />
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
