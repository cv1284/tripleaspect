import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, category, description, coaching_cues, default_video_url, tags } = await req.json();

  const validCategories = ['healing', 'forging', 'verse'];
  if (!name?.trim())                          return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!category)                              return NextResponse.json({ error: 'Category is required' }, { status: 400 });
  if (!validCategories.includes(category))    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  const parsedTags = typeof tags === 'string'
    ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : (tags ?? []);

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name:               name.trim(),
      category,
      description:        description?.trim() || null,
      coaching_cues:      coaching_cues?.trim() || null,
      default_video_url:  default_video_url?.trim() || null,
      custom_youtube_url: null,
      is_custom:          true,
      created_by_pt_id:   user.id,
      tags:               parsedTags.length > 0 ? parsedTags : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
