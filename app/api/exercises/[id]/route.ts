import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUuid, readJsonBody, stripHtmlTags } from '@/lib/utils';

// PATCH /api/exercises/[id]
// PT-only. Updates a custom exercise the PT created.
// Accepts any subset of: name, category, description, coaching_cues,
//   default_video_url, tags, is_shared.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { data: exercise } = await supabase
    .from('exercises')
    .select('id, is_custom, created_by_pt_id')
    .eq('id', id)
    .maybeSingle();

  if (!exercise) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!exercise.is_custom || exercise.created_by_pt_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  const b = body as Record<string, unknown>;

  // is_shared toggle
  if ('is_shared' in b) {
    if (typeof b.is_shared !== 'boolean') {
      return NextResponse.json({ error: 'is_shared must be a boolean' }, { status: 400 });
    }
    patch.is_shared = b.is_shared;
  }

  // name
  if ('name' in b) {
    if (typeof b.name !== 'string' || !b.name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const cleanName = stripHtmlTags(b.name.trim());
    if (!cleanName) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (cleanName.length > 100) return NextResponse.json({ error: 'Exercise name must be 100 characters or fewer' }, { status: 400 });
    patch.name = cleanName;
  }

  // category
  if ('category' in b) {
    const validCategories = ['healing', 'forging', 'verse'];
    if (!validCategories.includes(b.category as string)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    patch.category = b.category;
  }

  // description / coaching_cues / default_video_url
  const TEXT_MAX = 2000;
  const URL_MAX  = 500;
  for (const [field, limit] of [['description', TEXT_MAX], ['coaching_cues', TEXT_MAX], ['default_video_url', URL_MAX]] as [string, number][]) {
    if (field in b) {
      const val = b[field];
      if (val !== null && typeof val !== 'string') {
        return NextResponse.json({ error: `${field} must be a string` }, { status: 400 });
      }
      if (typeof val === 'string' && val.length > limit) {
        return NextResponse.json({ error: `${field} must be ${limit} characters or fewer` }, { status: 400 });
      }
      if (field === 'default_video_url') {
        const trimmed = typeof val === 'string' ? val.trim() : '';
        if (trimmed) {
          try {
            const { protocol } = new URL(trimmed);
            if (protocol !== 'http:' && protocol !== 'https:') {
              return NextResponse.json({ error: 'default_video_url: only http/https URLs are accepted' }, { status: 400 });
            }
          } catch {
            return NextResponse.json({ error: 'default_video_url: must be a valid URL' }, { status: 400 });
          }
        }
        patch[field] = trimmed || null;
      } else {
        patch[field] = typeof val === 'string' ? stripHtmlTags(val) || null : null;
      }
    }
  }

  // tags
  if ('tags' in b) {
    const rawTags = b.tags;
    const parsedTags = typeof rawTags === 'string'
      ? rawTags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : (Array.isArray(rawTags) ? rawTags : []);
    if (parsedTags.length > 20) return NextResponse.json({ error: 'Maximum 20 tags allowed' }, { status: 400 });
    if (parsedTags.some((t: string) => t.length > 50)) return NextResponse.json({ error: 'Each tag must be 50 characters or fewer' }, { status: 400 });
    patch.tags = parsedTags.length > 0 ? parsedTags : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('exercises')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/exercises/[id]
// PT-only. Deletes a custom exercise the PT created. Returns 409 if the
// exercise is referenced by any session items (FK constraint).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Verify this is a custom exercise owned by this PT
  const { data: exercise } = await supabase
    .from('exercises')
    .select('id, is_custom, created_by_pt_id')
    .eq('id', id)
    .maybeSingle();

  if (!exercise) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!exercise.is_custom || exercise.created_by_pt_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('exercises').delete().eq('id', id);

  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Exercise is used in existing sessions and cannot be deleted.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
