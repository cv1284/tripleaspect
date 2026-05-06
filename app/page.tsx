import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch profile — may not exist yet if trigger hadn't run at signup time
  let { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', user.id)
    .single();

  // Create the profile row if missing (covers existing auth users)
  if (!profile) {
    await supabase.from('profiles').upsert({
      id:    user.id,
      email: user.email!,
      role:  'client',
    });
    profile = { id: user.id, role: 'client' };
  }

  if (profile.role === 'pt')     redirect('/pt/clients');
  if (profile.role === 'client') redirect(`/portal/${user.id}`);

  redirect(`/portal/${user.id}`);
}
