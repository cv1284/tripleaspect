import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PTNav from '@/components/pt/PTNav';
import BugReportButton from '@/components/pt/BugReportButton';

export default async function PTLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email, avatar_url')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'pt') redirect('/login');

  const isOwner = user.email === process.env.ADMIN_EMAIL;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-0">
      <PTNav
        profile={{ full_name: profile.full_name, email: profile.email, avatar_url: profile.avatar_url }}
        isOwner={isOwner}
      />
      {/* pt-14 / pb-16 reserve space for mobile fixed header + bottom nav; lg resets to 0 */}
      <main className="flex-1 overflow-y-auto min-w-0 pt-14 lg:pt-0 pb-16 lg:pb-0">
        {children}
      </main>
      <BugReportButton userId={user.id} userEmail={user.email ?? ''} />
    </div>
  );
}
