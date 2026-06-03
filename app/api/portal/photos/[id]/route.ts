import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'progress-photos';

interface Params { params: Promise<{ id: string }> }

// DELETE /api/portal/photos/[id] — client deletes own photo
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Confirm ownership and get storage path in one query
  const { data: photo } = await supabase
    .from('progress_photos')
    .select('id, storage_path')
    .eq('id', id)
    .eq('client_id', user.id)
    .single();

  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([photo.storage_path]);

  const { error } = await admin
    .from('progress_photos')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
