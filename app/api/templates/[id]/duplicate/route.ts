import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/lib/utils';

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid template id' }, { status: 400 });

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch the source template — accessible if it's the PT's own or is public
  const { data: source, error: fetchErr } = await supabase
    .from('session_templates')
    .select(`
      id, title, category, notes,
      template_items:session_template_items(
        exercise_id, sort_order, prescribed_metrics,
        custom_coaching_cues, custom_youtube_url
      )
    `)
    .eq('id', id)
    .or(`pt_id.eq.${user.id},is_public.eq.true`)
    .maybeSingle();

  if (fetchErr || !source) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Create the copy as a private template owned by the current PT
  const { data: copy, error: copyErr } = await supabase
    .from('session_templates')
    .insert({
      pt_id:    user.id,
      pt_name:  profile.full_name ?? null,
      title:    `Copy of ${source.title}`,
      category: source.category,
      notes:    source.notes ?? null,
      is_public: false,
    })
    .select('id, pt_id, pt_name, title, category, notes, is_public, created_at, updated_at')
    .single();

  if (copyErr || !copy) {
    return NextResponse.json({ error: copyErr?.message ?? 'Failed to create copy' }, { status: 500 });
  }

  // Copy all template items
  const items = (source.template_items ?? []) as Array<{
    exercise_id:          string;
    sort_order:           number;
    prescribed_metrics:   Record<string, unknown>;
    custom_coaching_cues: string | null;
    custom_youtube_url:   string | null;
  }>;

  if (items.length > 0) {
    const { error: itemErr } = await supabase
      .from('session_template_items')
      .insert(items.map(item => ({ ...item, template_id: copy.id })));

    if (itemErr) {
      await supabase.from('session_templates').delete().eq('id', copy.id);
      return NextResponse.json({ error: 'Failed to copy exercises' }, { status: 500 });
    }
  }

  // Return the new template with items for immediate UI update
  const { data: full } = await supabase
    .from('session_templates')
    .select(`
      id, pt_id, pt_name, title, category, notes, is_public, created_at, updated_at,
      pt:profiles!session_templates_pt_id_fkey(logo_url),
      template_items:session_template_items(
        id, exercise_id, sort_order, prescribed_metrics,
        custom_coaching_cues, custom_youtube_url,
        exercise:exercises(*)
      )
    `)
    .eq('id', copy.id)
    .single();

  return NextResponse.json(full ?? copy, { status: 201 });
}
