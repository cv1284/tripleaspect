import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase    = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail  = process.env.ADMIN_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) redirect('/login');

  return <>{children}</>;
}
