import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface AgreementRow {
  id:           string;
  client_id:    string;
  pt_id:        string;
  renewal_date: string;
  agreement_model: string;
}

interface Profile {
  email:     string;
  full_name: string | null;
}

// Vercel Cron — runs daily at 08:00 UTC
// Emails clients 7, 3, and 1 day(s) before their renewal_date.
export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase  = createAdminClient();
  const today     = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Target dates: 1, 3, 7 days from now
  const targetDates = [1, 3, 7].map(d => {
    const dt = new Date(today);
    dt.setUTCDate(dt.getUTCDate() + d);
    return dt.toISOString().split('T')[0];
  });

  const { data: agreements, error } = await supabase
    .from('client_agreements')
    .select('id, client_id, pt_id, renewal_date, agreement_model')
    .eq('status', 'active')
    .in('renewal_date', targetDates)
    .or('renewal_reminder_sent_at.is.null,renewal_reminder_sent_at.lt.' + (() => {
      const cutoff = new Date(today);
      cutoff.setUTCDate(cutoff.getUTCDate() - 8);
      return cutoff.toISOString();
    })());

  if (error) {
    console.error('[cron/block-expiry] query error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!agreements?.length) {
    return NextResponse.json({ checked: 0, notified: 0 });
  }

  const results = await Promise.allSettled(
    (agreements as AgreementRow[]).map(async (row) => {
      const [{ data: client }, { data: pt }] = await Promise.all([
        supabase.from('profiles').select('email, full_name').eq('id', row.client_id).single<Profile>(),
        supabase.from('profiles').select('full_name').eq('id', row.pt_id).single<{ full_name: string | null }>(),
      ]);

      if (!client?.email) return;

      const renewalDate = new Date(row.renewal_date);
      const daysUntil   = Math.round((renewalDate.getTime() - today.getTime()) / 86_400_000);

      await sendRenewalReminderEmail({
        email:      client.email,
        clientName: client.full_name,
        ptName:     pt?.full_name,
        daysUntil,
        renewalDate: renewalDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      });

      await supabase
        .from('client_agreements')
        .update({ renewal_reminder_sent_at: new Date().toISOString() })
        .eq('id', row.id);
    }),
  );

  const notified = results.filter(r => r.status === 'fulfilled').length;
  return NextResponse.json({ checked: agreements.length, notified });
}

// ─── Email via Resend ──────────────────────────────────────

async function sendRenewalReminderEmail({
  email, clientName, ptName, daysUntil, renewalDate,
}: {
  email:       string;
  clientName:  string | null;
  ptName:      string | null | undefined;
  daysUntil:   number;
  renewalDate: string;
}) {
  const firstName = clientName?.split(' ')[0] ?? 'there';
  const ptDisplay = ptName ?? 'your PT';

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Brigid.pro <noreply@tripleaspect.fit>',
      to:      email,
      subject: `Your coaching plan renews in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`,
      html:    buildRenewalHtml({ firstName, ptDisplay, daysUntil, renewalDate }),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

function buildRenewalHtml({
  firstName, ptDisplay, daysUntil, renewalDate,
}: {
  firstName:   string;
  ptDisplay:   string;
  daysUntil:   number;
  renewalDate: string;
}) {
  const urgencyColor = daysUntil === 1 ? '#dc2626' : daysUntil === 3 ? '#d97706' : '#4f46e5';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
  <p style="font-size:18px;font-weight:600;margin-bottom:8px">Hi ${firstName},</p>
  <p style="margin-bottom:24px">
    Just a heads-up — your coaching plan with <strong>${ptDisplay}</strong> renews in
    <strong style="color:${urgencyColor}">${daysUntil} day${daysUntil !== 1 ? 's' : ''}</strong>
    on <strong>${renewalDate}</strong>.
  </p>
  <p style="font-size:13px;color:#666">
    If you have any questions about your plan or billing, reach out to ${ptDisplay} directly.
  </p>
  <p style="font-size:12px;color:#999;margin-top:32px">
    You're receiving this because you have an active coaching plan on Brigid.pro.
  </p>
</body>
</html>`;
}
