import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readJsonBody, stripHtmlTags } from '@/lib/utils';

// GET /api/programmes — own programmes + public from others
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('programmes')
    .select(`
      id, pt_id, title, description, category, total_weeks, is_public, created_at, updated_at,
      pt:profiles ( full_name, logo_url )
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/programmes — create a new programme with its week scaffold
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { title, description, category, total_weeks, is_public } = body as {
    title?: any; description?: any; category?: any; total_weeks?: any; is_public?: any;
  };
  if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  const cleanTitle = stripHtmlTags(title.trim());
  if (!cleanTitle) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const validCategories = ['healing', 'forging', 'verse'];
  if (category && !validCategories.includes(category)) {
    return NextResponse.json({ error: 'Invalid category. Must be one of: healing, forging, verse' }, { status: 400 });
  }

  const parsedWeeks = parseInt(total_weeks ?? '4');
  if (isNaN(parsedWeeks)) {
    return NextResponse.json({ error: 'total_weeks must be a number' }, { status: 400 });
  }
  const weeks = Math.min(Math.max(parsedWeeks, 1), 52);

  const { data: programme, error: progErr } = await supabase
    .from('programmes')
    .insert({
      pt_id:       user.id,
      title:       cleanTitle,
      description: typeof description === 'string' ? stripHtmlTags(description) || null : null,
      category:    category || null,
      total_weeks: weeks,
      is_public:   is_public ?? false,
    })
    .select('id, pt_id, title, description, category, total_weeks, is_public, created_at, updated_at')
    .single();

  if (progErr || !programme) {
    return NextResponse.json({ error: progErr?.message ?? 'Failed to create programme' }, { status: 500 });
  }

  // Scaffold week rows
  const weekPayloads = Array.from({ length: weeks }, (_, i) => ({
    programme_id: programme.id,
    week_number:  i + 1,
    label:        null,
  }));
  await supabase.from('programme_weeks').insert(weekPayloads);

  return NextResponse.json(programme, { status: 201 });
}
