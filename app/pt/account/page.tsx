import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AccountClient from './AccountClient';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single();

  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold text-slate-100 mb-1">Account</h1>
      <p className="text-sm text-slate-500 font-mono mb-6">Manage your PT profile</p>
      <AccountClient
        userId={user.id}
        initialName={profile?.full_name ?? ''}
        email={profile?.email ?? user.email ?? ''}
        isAdmin={isAdmin}
      />
    </div>
  );
}
