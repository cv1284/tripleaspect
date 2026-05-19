import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SessionTemplate } from '@/types/database';
import TemplatesClient from './TemplatesClient';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'pt') redirect(`/portal/${user.id}`);

  const { data: templates } = await supabase
    .from('session_templates')
    .select(`
      id, pt_id, pt_name, title, category, notes, is_public, created_at, updated_at,
      pt:profiles!session_templates_pt_id_fkey(logo_url),
      template_items:session_template_items(id, sort_order, exercise_id, prescribed_metrics, custom_coaching_cues, custom_youtube_url)
    `)
    .order('created_at', { ascending: false });

  return (
    <TemplatesClient
      ptId={user.id}
      initialTemplates={(templates ?? []) as unknown as SessionTemplate[]}
    />
  );
}
