import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readJsonBody, stripHtmlTags } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { name, category, description, coaching_cues, default_video_url, tags } = body as {
    name?: any; category?: any; description?: any;
    coaching_cues?: any; default_video_url?: any; tags?: any;
  };

  const validCategories = ['healing', 'forging', 'verse'];
  if (typeof name !== 'string' || !name.trim())              return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const cleanName = stripHtmlTags(name);
  if (!cleanName)                             return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (cleanName.length > 100)                 return NextResponse.json({ error: 'Exercise name must be 100 characters or fewer' }, { status: 400 });
  if (!category)                              return NextResponse.json({ error: 'Category is required' }, { status: 400 });
  if (!validCategories.includes(category))    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  const TEXT_MAX = 2000;
  const URL_MAX  = 500;
  for (const [field, val] of Object.entries({ description, coaching_cues, default_video_url })) {
    if (val !== undefined && val !== null && typeof val !== 'string') {
      return NextResponse.json({ error: `${field} must be a string` }, { status: 400 });
    }
    const limit = field === 'default_video_url' ? URL_MAX : TEXT_MAX;
    if (typeof val === 'string' && val.length > limit) {
      return NextResponse.json({ error: `${field} must be ${limit} characters or fewer` }, { status: 400 });
    }
  }

  const parsedTags = typeof tags === 'string'
    ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : (tags ?? []);
  if (parsedTags.length > 20) return NextResponse.json({ error: 'Maximum 20 tags allowed' }, { status: 400 });
  if (parsedTags.some((t: string) => t.length > 50)) return NextResponse.json({ error: 'Each tag must be 50 characters or fewer' }, { status: 400 });

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name:               cleanName,
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
