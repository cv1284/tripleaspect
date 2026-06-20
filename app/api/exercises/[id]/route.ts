import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUuid, readJsonBody } from '@/lib/utils';

// PATCH /api/exercises/[id]
// PT-only. Toggles is_shared on a custom exercise the PT created.
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
  if (body === null || typeof (body as Record<string, unknown>).is_shared !== 'boolean') {
    return NextResponse.json({ error: 'is_shared (boolean) is required' }, { status: 400 });
  }
  const { is_shared } = body as { is_shared: boolean };

  const { data: exercise } = await supabase
    .from('exercises')
    .select('id, is_custom, created_by_pt_id')
    .eq('id', id)
    .maybeSingle();

  if (!exercise) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!exercise.is_custom || exercise.created_by_pt_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('exercises')
    .update({ is_shared })
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
