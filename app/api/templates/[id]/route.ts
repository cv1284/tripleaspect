import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readJsonBody, isValidUuid, stripHtmlTags } from '@/lib/utils';

interface Params { params: Promise<{ id: string }> }

// PATCH /api/templates/[id]
// Toggle is_public/is_pinned or rename a template. Only the owning PT can update.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isValidUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const allowed = ['title', 'is_public', 'is_pinned', 'notes'] as const;
  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) => (allowed as readonly string[]).includes(k)),
  );

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  if ('title' in patch) {
    if (typeof patch.title !== 'string' || !(patch.title as string).trim()) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    patch.title = stripHtmlTags((patch.title as string).trim());
    if (!patch.title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
  }
  if ('notes' in patch && typeof patch.notes === 'string') {
    patch.notes = stripHtmlTags(patch.notes.trim()) || null;
  }
  if ('is_pinned' in patch && typeof patch.is_pinned !== 'boolean') {
    return NextResponse.json({ error: 'is_pinned must be a boolean' }, { status: 400 });
  }
  if ('is_public' in patch && typeof patch.is_public !== 'boolean') {
    return NextResponse.json({ error: 'is_public must be a boolean' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('session_templates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('pt_id', user.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(data);
}

// DELETE /api/templates/[id]
// Permanently delete a template (cascades to items).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Confirm ownership before delete
  const { data: tmpl } = await supabase
    .from('session_templates')
    .select('id')
    .eq('id', id)
    .eq('pt_id', user.id)
    .maybeSingle();

  if (!tmpl) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('session_templates')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
