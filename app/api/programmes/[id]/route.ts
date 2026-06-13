import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readJsonBody, isValidUuid } from '@/lib/utils';

interface Params { params: Promise<{ id: string }> }

// GET /api/programmes/[id] — full programme tree
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isValidUuid(id)) return NextResponse.json({ error: 'Programme not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('programmes')
    .select(`
      id, pt_id, title, description, category, total_weeks, is_public, created_at, updated_at,
      weeks:programme_weeks (
        id, week_number, label,
        sessions:programme_sessions (
          id, day_of_week, title, category, notes, sort_order, template_id,
          items:programme_session_items (
            id, exercise_id, sort_order, prescribed_metrics,
            custom_coaching_cues, custom_youtube_url,
            exercise:exercises ( id, name, category, coaching_cues, tags )
          )
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: 'Programme not found' }, { status: 404 });

  // Sort weeks and sessions
  if (data.weeks) {
    data.weeks.sort((a: { week_number: number }, b: { week_number: number }) => a.week_number - b.week_number);
    for (const week of data.weeks as Array<{ sessions?: Array<{ sort_order: number }> }>) {
      week.sessions?.sort((a, b) => a.sort_order - b.sort_order);
    }
  }

  return NextResponse.json(data);
}

// PATCH /api/programmes/[id] — update metadata
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isValidUuid(id)) return NextResponse.json({ error: 'Programme not found' }, { status: 404 });

  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const allowed = ['title', 'description', 'category', 'is_public'];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  if ('title' in patch && (typeof patch.title !== 'string' || !(patch.title as string).trim())) {
    return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
  }
  if ('title' in patch) patch.title = (patch.title as string).trim();

  const validCategories = ['healing', 'forging', 'verse'];
  if ('category' in patch && patch.category && !validCategories.includes(patch.category as string)) {
    return NextResponse.json({ error: 'Invalid category. Must be one of: healing, forging, verse' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('programmes')
    .update(patch)
    .eq('id', id)
    .eq('pt_id', user.id)
    .select('id, title, description, category, total_weeks, is_public, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/programmes/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isValidUuid(id)) return NextResponse.json({ error: 'Programme not found' }, { status: 404 });

  const { error } = await supabase
    .from('programmes')
    .delete()
    .eq('id', id)
    .eq('pt_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
