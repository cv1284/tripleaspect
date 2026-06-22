import { NextRequest, NextResponse } from 'next/server';
import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { bugRefLabel }       from '@/types/database';
import { escapeHtml, readJsonBody, stripHtmlTags } from '@/lib/utils';

// POST /api/bug-reports — any authenticated user
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { url, page_title, notes, report_type, screenshot_url } = body as {
    url?: unknown; page_title?: unknown; notes?: unknown; report_type?: unknown; screenshot_url?: unknown;
  };
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

  // Reject non-http(s) URLs — prevents javascript: or data: URIs reaching the DB and email templates
  if (typeof url === 'string' && url) {
    try {
      const { protocol } = new URL(url, 'https://tripleaspect.fit');
      if (protocol !== 'http:' && protocol !== 'https:') {
        return NextResponse.json({ error: 'url: only http/https URLs are accepted' }, { status: 400 });
      }
    } catch {
      // Relative path (e.g. /pt/clients) is fine — the BugReportButton sends pathname+search
    }
  }

  const admin = createAdminClient();

  // Rate limit: 5 reports per user per hour
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('bug_reports')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', windowStart);
  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: 'Too many reports — please wait before submitting again.' },
      { status: 429 }
    );
  }

  const { data: report, error } = await admin
    .from('bug_reports')
    .insert({
      user_id:        user.id,
      url,
      page_title:     page_title || url,
      notes:          typeof notes === 'string' ? stripHtmlTags(notes.trim()).slice(0, 2000) || null : null,
      report_type:    report_type === 'feature' ? 'feature' : 'bug',
      screenshot_url: screenshot_url || null,
      user_agent:     req.headers.get('user-agent'),
    })
    .select('id, ref, report_type, notes, url, page_title')
    .single();

  if (error || !report) {
    return NextResponse.json({ error: error?.message ?? 'Failed to save' }, { status: 500 });
  }

  const label = bugRefLabel(report as { ref: number; report_type: 'bug' | 'feature' });

  // Non-blocking admin alert email
  sendAdminAlertEmail({
    label,
    reportType: report.report_type as 'bug' | 'feature',
    pageTitle:  report.page_title,
    url:        report.url,
    notes:      report.notes,
    userEmail:  user.email ?? '',
  }).catch(console.error);

  return NextResponse.json({ ok: true, id: report.id, ref: report.ref, label }, { status: 201 });
}

// GET /api/bug-reports — admin only
export async function GET(req: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const supabase   = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('bug_reports')
    .select(`
      id, ref, user_id, url, page_title, notes, screenshot_url,
      user_agent, report_type, status, resolved_note, resolved_at, created_at,
      user:profiles ( full_name, email )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// ─── Admin alert email ─────────────────────────────────────

async function sendAdminAlertEmail({
  label, reportType, pageTitle, url, notes, userEmail,
}: {
  label:      string;
  reportType: 'bug' | 'feature';
  pageTitle:  string;
  url:        string;
  notes:      string | null;
  userEmail:  string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !process.env.RESEND_API_KEY) return;

  const typeLabel  = reportType === 'bug' ? '🐛 Bug report' : '💡 Feature request';
  const accentColor = reportType === 'bug' ? '#f97316' : '#8b5cf6';

  const safeLabel     = escapeHtml(label);
  const safeEmail     = escapeHtml(userEmail);
  const safeUrl       = escapeHtml(url);
  const safePageTitle = escapeHtml(pageTitle);
  const safeNotes     = escapeHtml(notes);

  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Brigid.pro <noreply@tripleaspect.fit>',
      to:      adminEmail,
      subject: `${label} — ${typeLabel} from ${userEmail}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
  <div style="display:inline-block;background:${accentColor}20;border:1px solid ${accentColor}40;border-radius:6px;padding:4px 10px;margin-bottom:16px">
    <span style="font-family:monospace;font-size:13px;color:${accentColor};font-weight:600">${safeLabel}</span>
    <span style="font-family:monospace;font-size:12px;color:#666;margin-left:8px">${typeLabel}</span>
  </div>
  <p style="margin:0 0 4px;font-size:13px;color:#666">From: <strong>${safeEmail}</strong></p>
  <p style="margin:0 0 16px;font-size:13px;color:#666">Page: <a href="${safeUrl}" style="color:#4f46e5">${safePageTitle}</a></p>
  ${notes ? `<div style="background:#f8f8f8;border-left:3px solid ${accentColor};padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:16px">
    <p style="margin:0;font-size:14px;line-height:1.6">${safeNotes}</p>
  </div>` : ''}
  <a href="https://tripleaspect.fit/admin" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">
    View in admin →
  </a>
</body>
</html>`,
    }),
  });
}
