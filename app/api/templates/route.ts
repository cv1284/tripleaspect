import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/templates
// Returns the PT's own templates + all public templates from other PTs.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: templates, error } = await supabase
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
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(templates ?? []);
}

// POST /api/templates
// Create a new session template from the builder.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { title, category, notes, is_public, items } = body as {
    title:     string;
    category:  string;
    notes?:    string;
    is_public?: boolean;
    items: Array<{
      exercise_id:          string;
      sort_order:           number;
      prescribed_metrics:   Record<string, unknown>;
      custom_coaching_cues: string | null;
      custom_youtube_url:   string | null;
    }>;
  };

  const validCategories = ['healing', 'forging', 'verse'];
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  if (!category || !validCategories.includes(category)) {
    return NextResponse.json({ error: 'category must be one of: healing, forging, verse' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'At least one exercise required' }, { status: 400 });
  }

  const { data: template, error: tmplErr } = await supabase
    .from('session_templates')
    .insert({
      pt_id:    user.id,
      pt_name:  profile.full_name ?? null,
      title:    title.trim(),
      category,
      notes:     notes?.trim() || null,
      is_public: is_public ?? false,
    })
    .select('id')
    .single();

  if (tmplErr || !template) {
    return NextResponse.json({ error: tmplErr?.message ?? 'Failed to create template' }, { status: 500 });
  }

  const { error: itemErr } = await supabase
    .from('session_template_items')
    .insert(items.map(item => ({ ...item, template_id: template.id })));

  if (itemErr) {
    // Roll back the orphan header so we never leave a template with no items
    await supabase.from('session_templates').delete().eq('id', template.id);
    // FK violation means the caller passed a non-existent exercise_id → 400, not 500
    const isConstraintViolation = itemErr.code === '23503';
    return NextResponse.json(
      { error: isConstraintViolation ? 'One or more exercise IDs are invalid' : itemErr.message },
      { status: isConstraintViolation ? 400 : 500 },
    );
  }

  return NextResponse.json({ id: template.id }, { status: 201 });
}
