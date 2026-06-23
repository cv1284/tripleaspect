import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { escapeHtml } from '@/lib/utils';

interface SessionRow {
  id:         string;
  title:      string;
  client_id:  string;
}

interface Profile {
  email:     string;
  full_name: string | null;
}

// Vercel Cron — runs daily at 07:00 UTC
// Emails clients who have a session scheduled for today that isn't yet complete.
// Note: sessions store scheduled_date (DATE only), so we send a morning-of reminder.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today    = new Date().toISOString().split('T')[0];

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, title, client_id')
    .eq('scheduled_date', today)
    .is('completed_at', null);

  if (error) {
    console.error('[cron/session-reminder] query error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!sessions?.length) {
    return NextResponse.json({ sessions: 0, notified: 0 });
  }

  const results = await Promise.allSettled(
    (sessions as SessionRow[]).map(async (session) => {
      const { data: client } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', session.client_id)
        .single<Profile>();

      if (!client?.email) return;

      await sendSessionReminderEmail({
        email:        client.email,
        clientName:   client.full_name,
        sessionTitle: session.title,
      });
    }),
  );

  const notified = results.filter(r => r.status === 'fulfilled').length;
  return NextResponse.json({ sessions: sessions.length, notified });
}

// ─── Email via Resend ──────────────────────────────────────

async function sendSessionReminderEmail({
  email, clientName, sessionTitle,
}: {
  email:        string;
  clientName:   string | null;
  sessionTitle: string;
}) {
  const firstName = clientName?.split(' ')[0] ?? 'there';

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Brigid.pro <noreply@tripleaspect.fit>',
      to:      email,
      subject: `You have a session today: ${sessionTitle}`,
      html:    buildReminderHtml({ firstName, sessionTitle }),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

function buildReminderHtml({
  firstName, sessionTitle,
}: {
  firstName:    string;
  sessionTitle: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
  <p style="font-size:18px;font-weight:600;margin-bottom:8px">Good morning, ${escapeHtml(firstName)} 👋</p>
  <p style="margin-bottom:24px">You have a session scheduled for today:</p>
  <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:16px;margin-bottom:24px">
    <p style="margin:0;font-size:16px;font-weight:600;color:#3730a3">${escapeHtml(sessionTitle)}</p>
  </div>
  <a href="https://tripleaspect.fit"
     style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
    Open my portal →
  </a>
  <p style="font-size:12px;color:#999;margin-top:32px">
    You're receiving this because you have a coaching session scheduled for today on Brigid.pro.
  </p>
</body>
</html>`;
}
