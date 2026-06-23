import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { signToken } from '@/lib/inactivity-token';
import { escapeHtml } from '@/lib/utils';

interface FlaggedRow {
  agreement_id: string;
  client_id: string;
  pt_id: string;
}

interface ClientProfile {
  email: string;
  full_name: string | null;
}

// Vercel Cron calls this with Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: flagged, error } = await supabase.rpc('fn_flag_inactive_agreements');
  if (error) {
    console.error('[cron/flag-inactive] rpc error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!flagged?.length) {
    return NextResponse.json({ flagged: 0, notified: 0 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tripleaspect.fit';

  const results = await Promise.allSettled(
    (flagged as FlaggedRow[]).map(async (row) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', row.client_id)
        .single<ClientProfile>();

      if (!profile?.email) return;

      const token     = signToken(row.agreement_id);
      const keepUrl   = `${baseUrl}/api/inactivity-response?token=${token}&action=keep`;
      const deleteUrl = `${baseUrl}/api/inactivity-response?token=${token}&action=delete`;

      await sendInactivityEmail({
        email:     profile.email,
        name:      profile.full_name,
        keepUrl,
        deleteUrl,
      });

      await supabase
        .from('client_agreements')
        .update({ inactivity_notified_at: new Date().toISOString() })
        .eq('id', row.agreement_id);
    }),
  );

  const notified = results.filter((r) => r.status === 'fulfilled').length;
  return NextResponse.json({ flagged: flagged.length, notified });
}

// ─── Email via Resend REST API (no SDK dependency) ────────
async function sendInactivityEmail({
  email,
  name,
  keepUrl,
  deleteUrl,
}: {
  email: string;
  name: string | null;
  keepUrl: string;
  deleteUrl: string;
}) {
  const firstName = name?.split(' ')[0] ?? 'there';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Brigid.pro <noreply@tripleaspect.fit>',
      to:      email,
      subject: 'Your coaching data will be deleted in 14 days',
      html:    buildEmailHtml({ firstName, keepUrl, deleteUrl }),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

function buildEmailHtml({
  firstName,
  keepUrl,
  deleteUrl,
}: {
  firstName: string;
  keepUrl: string;
  deleteUrl: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
  <p style="font-size:18px;font-weight:600;margin-bottom:8px">Hi ${escapeHtml(firstName)},</p>
  <p style="margin-bottom:16px">
    Your Brigid.pro coaching account has been inactive for 6 months.
    Unless you take action, <strong>your data will be permanently deleted in 14 days</strong>.
  </p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <tr>
      <td style="padding:8px">
        <a href="${keepUrl}"
           style="display:block;text-align:center;background:#4f46e5;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Keep my data for 6 more months
        </a>
      </td>
      <td style="padding:8px">
        <a href="${deleteUrl}"
           style="display:block;text-align:center;background:#f5f5f5;color:#1a1a1a;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;border:1px solid #e0e0e0">
          Delete my data now
        </a>
      </td>
    </tr>
  </table>
  <p style="font-size:13px;color:#666">
    If you do nothing, your PT will be notified to complete the deletion after 14 days.
    This link is valid for 7 days.
  </p>
</body>
</html>`;
}
