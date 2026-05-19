import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET        = 'pt-logos';
const MAX_BYTES     = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

// POST /api/pt/logo — uploads brand logo, saves to profiles.logo_url
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('logo') as File | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP or SVG files are accepted.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be under 2 MB.' }, { status: 400 });
  }

  const ext    = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1];
  const path   = `${user.id}/logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path);
  const bustUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ logo_url: bustUrl })
    .eq('id', user.id);

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  return NextResponse.json({ url: bustUrl });
}

// DELETE /api/pt/logo — removes brand logo from storage and clears logo_url
export async function DELETE(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'svg']) {
    await admin.storage.from(BUCKET).remove([`${user.id}/logo.${ext}`]);
  }

  const { error } = await supabase
    .from('profiles')
    .update({ logo_url: null })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
