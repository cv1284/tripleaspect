import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyToken } from '@/lib/inactivity-token';

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const token  = req.nextUrl.searchParams.get('token');
  const action = req.nextUrl.searchParams.get('action');

  if (!token || (action !== 'keep' && action !== 'delete')) {
    return html('Invalid link.', 400);
  }

  const payload = verifyToken(token);
  if (!payload) {
    return html('This link has expired or is no longer valid.', 410);
  }

  const supabase = createAdminClient();

  if (action === 'keep') {
    const { error } = await supabase
      .from('client_agreements')
      .update({
        inactivity_flagged_at:  null,
        inactivity_notified_at: null,
        inactivity_keep_until:  new Date(Date.now() + SIX_MONTHS_MS).toISOString(),
      })
      .eq('id', payload.agreementId);

    if (error) return html('Something went wrong. Please contact your PT.', 500);

    return html(
      'Your data has been kept. We\'ll check in again in 6 months.',
      200,
      '#4f46e5',
    );
  }

  // action === 'delete' — schedule 14-day deferred deletion (same flow PT uses)
  const { error } = await supabase
    .from('client_agreements')
    .update({
      deletion_scheduled_at: new Date(Date.now() + FOURTEEN_DAYS_MS).toISOString(),
      deletion_reason:       'inactivity_client_confirmed',
    })
    .eq('id', payload.agreementId);

  if (error) return html('Something went wrong. Please contact your PT.', 500);

  return html(
    'Understood. Your data will be permanently deleted within 14 days.',
    200,
    '#dc2626',
  );
}

function html(message: string, status: number, accentColor = '#1a1a1a') {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Brigid.pro</title>
</head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9f9f9">
  <div style="max-width:420px;text-align:center;padding:40px 24px">
    <p style="font-size:32px;margin-bottom:16px">✓</p>
    <p style="font-size:18px;color:${accentColor};font-weight:600;margin-bottom:8px">${message}</p>
    <p style="font-size:13px;color:#888">You can close this tab.</p>
  </div>
</body>
</html>`;

  return new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/html' },
  });
}
