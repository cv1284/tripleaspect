import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'pt') redirect('/pt/clients');
  if (profile?.role === 'client') redirect(`/portal/${user.id}`);

  // Fallback — profile row not yet created
  redirect('/login');
}
