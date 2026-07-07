import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET        = 'exercise-videos';
const MAX_BYTES     = 25 * 1024 * 1024; // 25 MB — matches the bucket's file_size_limit
const ALLOWED_TYPES: Record<string, string> = {
  'video/mp4':  'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'image/gif':  'gif',
};

// POST /api/exercises/video — PT uploads a demo video/GIF for a custom exercise,
// returns a public URL to store on Exercise.default_video_url.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get('video') as File | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Only MP4, WebM, MOV or GIF files are accepted.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be under 25 MB.' }, { status: 400 });
  }

  const path   = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ url: publicUrl }, { status: 201 });
}
