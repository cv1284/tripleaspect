import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect }          from 'next/navigation';
import AdminClient           from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || user.email !== adminEmail) redirect('/');

  // Use admin client to read all profiles (bypasses RLS)
  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, email, full_name, role, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <p className="text-red-400 font-mono text-sm">{error.message}</p>
      </div>
    );
  }

  return <AdminClient profiles={profiles ?? []} currentUserId={user.id} />;
}
