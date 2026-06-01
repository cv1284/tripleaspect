import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  const { title, description, category, total_weeks, is_public } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const weeks = Math.min(Math.max(parseInt(total_weeks ?? '4'), 1), 52);

  const { data: programme, error: progErr } = await supabase
    .from('programmes')
    .insert({
      pt_id:       user.id,
      title:       title.trim(),
      description: description || null,
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
