import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { escapeHtml, readJsonBody } from '@/lib/utils';

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase          = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify this user owns the session (as client) — also grab pt_id and title for the alert email
  const { data: session } = await supabase
    .from('sessions')
    .select('id, client_id, pt_id, title, completed_at')
    .eq('id', sessionId)
    .eq('client_id', user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.completed_at) {
    return NextResponse.json({ message: 'Already completed', completed_at: session.completed_at });
  }

  const body        = await readJsonBody(req);
  const rawNotes    = (body as Record<string, unknown> | null)?.notes;
  const clientNotes = typeof rawNotes === 'string' ? rawNotes.trim().slice(0, 500) || null : null;

  const completedAt = new Date().toISOString();

  const { error } = await supabase
    .from('sessions')
    .update({ completed_at: completedAt, client_notes: clientNotes })
    .eq('id', sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire PT alert email — non-blocking so a Resend failure never breaks this response
  sendPtAlertEmail(session.pt_id, user.id, session.title, completedAt).catch(console.error);

  return NextResponse.json({ success: true, completed_at: completedAt });
}

// ─── PT alert email ────────────────────────────────────────

async function sendPtAlertEmail(
  ptId:        string,
  clientId:    string,
  sessionTitle: string,
  completedAt: string,
) {
  const admin = createAdminClient();

  const [{ data: pt }, { data: client }] = await Promise.all([
    admin.from('profiles').select('email, full_name').eq('id', ptId).single(),
    admin.from('profiles').select('full_name').eq('id', clientId).single(),
  ]);

  if (!pt?.email) return;

  const clientName  = client?.full_name ?? 'Your client';
  const ptFirstName = pt.full_name?.split(' ')[0] ?? 'there';
  const date        = new Date(completedAt).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Brigid.pro <noreply@tripleaspect.fit>',
      to:      pt.email,
      subject: `✓ ${clientName} completed ${sessionTitle}`,
      html:    buildAlertHtml({ ptFirstName, clientName, sessionTitle, date }),
    }),
  }).then(async r => {
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  });
}

function buildAlertHtml({
  ptFirstName, clientName, sessionTitle, date,
}: {
  ptFirstName: string;
  clientName:  string;
  sessionTitle: string;
  date:        string;
}) {
  const safePtFirstName  = escapeHtml(ptFirstName);
  const safeClientName   = escapeHtml(clientName);
  const safeSessionTitle = escapeHtml(sessionTitle);
  const safeDate         = escapeHtml(date);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
  <p style="font-size:18px;font-weight:600;margin-bottom:8px">Hi ${safePtFirstName},</p>
  <p style="margin-bottom:24px">
    <strong>${safeClientName}</strong> just completed their session on ${safeDate}.
  </p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px">
    <p style="margin:0;font-size:15px;font-weight:600;color:#166534">${safeSessionTitle}</p>
    <p style="margin:4px 0 0;font-size:13px;color:#15803d">Completed ${safeDate}</p>
  </div>
  <p style="font-size:13px;color:#666">
    Log in to <a href="https://tripleaspect.fit/pt/clients" style="color:#4f46e5">brigid.pro</a> to review their progress.
  </p>
</body>
</html>`;
}
