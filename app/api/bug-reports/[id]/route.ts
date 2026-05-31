import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { bugRefLabel }       from '@/types/database';
import { escapeHtml }        from '@/lib/utils';

interface Params { params: Promise<{ id: string }> }

// PATCH /api/bug-reports/[id] — admin only, resolves a report
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const adminEmail = process.env.ADMIN_EMAIL;
  const supabase   = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { resolved_note } = await req.json();
  const admin = createAdminClient();

  // Fetch the report first to guard against double-resolve + get reporter info
  const { data: existing } = await admin
    .from('bug_reports')
    .select('id, ref, report_type, status, user_id, page_title, url')
    .eq('id', id)
    .single();

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.status === 'resolved') {
    return NextResponse.json({ error: 'Already resolved' }, { status: 400 });
  }

  const { error } = await admin
    .from('bug_reports')
    .update({
      status:        'resolved',
      resolved_note: resolved_note || null,
      resolved_at:   new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Non-blocking notification email to the reporter
  const label = bugRefLabel(existing as { ref: number; report_type: 'bug' | 'feature' });
  sendReporterEmail({
    userId:       existing.user_id,
    label,
    pageTitle:    existing.page_title,
    resolvedNote: resolved_note || null,
  }).catch(console.error);

  return NextResponse.json({ ok: true });
}

async function sendReporterEmail({
  userId, label, pageTitle, resolvedNote,
}: {
  userId:       string;
  label:        string;
  pageTitle:    string;
  resolvedNote: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const admin = createAdminClient();
  const { data: reporter } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single();

  if (!reporter?.email) return;

  const firstName = reporter.full_name?.split(' ')[0] ?? 'there';

  const safeFirstName   = escapeHtml(firstName);
  const safeLabel       = escapeHtml(label);
  const safePageTitle   = escapeHtml(pageTitle);
  const safeResolvedNote = escapeHtml(resolvedNote);

  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Brigid.pro <noreply@tripleaspect.fit>',
      to:      reporter.email,
      subject: `${label} has been resolved`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
  <p style="font-size:18px;font-weight:600;margin-bottom:8px">Hi ${safeFirstName},</p>
  <p style="margin-bottom:16px">
    Your report <strong style="font-family:monospace">${safeLabel}</strong> on <em>${safePageTitle}</em> has been resolved.
  </p>
  ${resolvedNote ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px">
    <p style="margin:0;font-size:14px;line-height:1.6;color:#166534">${safeResolvedNote}</p>
  </div>` : ''}
  <p style="font-size:13px;color:#666">Thanks for helping make Brigid.pro better.</p>
</body>
</html>`,
    }),
  });
}
