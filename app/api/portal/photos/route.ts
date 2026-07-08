import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripHtmlTags, isValidUuid, isValidDateString } from '@/lib/utils';

const BUCKET        = 'progress-photos';
const MAX_BYTES     = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// POST /api/portal/photos — client uploads a progress photo
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'client') {
    return NextResponse.json({ error: 'Only clients can upload progress photos' }, { status: 403 });
  }

  const formData = await req.formData();
  const file     = formData.get('photo')    as File   | null;
  const notes    = formData.get('notes')    as string | null;
  const takenAt  = formData.get('taken_at') as string | null;

  if (!file) return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG or WebP photos are accepted.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Photo must be under 10 MB.' }, { status: 400 });
  }

  // Validate taken_at if provided — a shape-only regex would accept
  // calendar-invalid values like "2026-13-99" and raw-500 out of Postgres
  if (takenAt && !isValidDateString(takenAt)) {
    return NextResponse.json({ error: 'taken_at must be a valid date (YYYY-MM-DD)' }, { status: 400 });
  }
  const dateValue = takenAt || new Date().toISOString().split('T')[0];

  const ext    = file.type.split('/')[1];
  const path   = `${user.id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const admin  = createAdminClient();

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path);

  const { data: photo, error: dbErr } = await admin
    .from('progress_photos')
    .insert({
      client_id:    user.id,
      storage_path: path,
      public_url:   publicUrl,
      notes:        typeof notes === 'string' ? stripHtmlTags(notes.trim()).slice(0, 500) || null : null,
      taken_at:     dateValue,
    })
    .select('id, public_url, notes, taken_at, created_at')
    .single();

  if (dbErr) {
    await admin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json(photo, { status: 201 });
}

// GET /api/portal/photos?clientId= — list photos (client: own; PT: their client's)
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();

  let targetClientId: string;

  if (profile?.role === 'pt') {
    const clientId = req.nextUrl.searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });
    if (!isValidUuid(clientId)) return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });

    const { data: agreement } = await supabase
      .from('client_agreements').select('id')
      .eq('pt_id', user.id).eq('client_id', clientId).single();
    if (!agreement) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    targetClientId = clientId;
  } else {
    targetClientId = user.id;
  }

  const { data: photos, error } = await supabase
    .from('progress_photos')
    .select('id, public_url, notes, taken_at, created_at')
    .eq('client_id', targetClientId)
    .order('taken_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(photos ?? []);
}
