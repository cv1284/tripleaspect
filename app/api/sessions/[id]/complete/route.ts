import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase          = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify this user owns the session (as client)
  const { data: session } = await supabase
    .from('sessions')
    .select('id, client_id, completed_at')
    .eq('id', sessionId)
    .eq('client_id', user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.completed_at) {
    return NextResponse.json({ message: 'Already completed', completed_at: session.completed_at });
  }

  const completedAt = new Date().toISOString();

  const { error } = await supabase
    .from('sessions')
    .update({ completed_at: completedAt })
    .eq('id', sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, completed_at: completedAt });
}
