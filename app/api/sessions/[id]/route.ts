import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUuid } from '@/lib/utils';

interface Params { params: Promise<{ id: string }> }

// DELETE — PT deletes one of their sessions (cascades to session_items)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Confirm PT owns this session before deleting
  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', id)
    .eq('pt_id', user.id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
