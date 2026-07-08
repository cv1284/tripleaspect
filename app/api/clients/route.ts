import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrCreateCustomer, createSubscription, createPaymentIntent } from '@/lib/stripe';
import { isValidEmail, isValidDateString, readJsonBody, stripHtmlTags } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Verify caller is an authenticated PT
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ptProfile } = await supabase
    .from('profiles').select('role, free_client_quota').eq('id', user.id).single();
  if (ptProfile?.role !== 'pt') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const reqBody = await readJsonBody(req);
  if (reqBody === null) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const {
    full_name, email,
    agreement_model, start_date, renewal_date, program_length_weeks,
    manual_price_numeric, manual_currency,
  } = reqBody as {
    full_name?: any; email?: any;
    agreement_model?: any; start_date?: any; renewal_date?: any; program_length_weeks?: any;
    manual_price_numeric?: any; manual_currency?: any;
  };

  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });

  // full_name is optional, but if present must be a string — a non-string
  // (number/object/array) used to skip validation entirely and reach the
  // DB unvalidated, and unlike other name/title fields it wasn't run
  // through stripHtmlTags before storage.
  let cleanFullName: string | null = null;
  if (full_name !== undefined && full_name !== null && full_name !== '') {
    if (typeof full_name !== 'string') {
      return NextResponse.json({ error: 'full_name must be a string' }, { status: 400 });
    }
    cleanFullName = stripHtmlTags(full_name.trim());
    if (cleanFullName.length > 255) {
      return NextResponse.json({ error: 'Client name must be 255 characters or fewer' }, { status: 400 });
    }
    cleanFullName = cleanFullName || null;
  }

  const validModels = ['subscription', 'fixed_block', 'hybrid'];
  if (agreement_model && !validModels.includes(agreement_model)) {
    return NextResponse.json({ error: 'Invalid agreement_model' }, { status: 400 });
  }

  if (start_date != null && !isValidDateString(start_date)) {
    return NextResponse.json({ error: 'start_date must be a valid date (YYYY-MM-DD)' }, { status: 400 });
  }
  if (renewal_date != null && renewal_date !== '' && !isValidDateString(renewal_date)) {
    return NextResponse.json({ error: 'renewal_date must be a valid date (YYYY-MM-DD)' }, { status: 400 });
  }

  const parsedWeeks = program_length_weeks != null ? parseInt(program_length_weeks) : null;
  if (parsedWeeks !== null && (isNaN(parsedWeeks) || parsedWeeks < 1 || parsedWeeks > 260)) {
    return NextResponse.json({ error: 'program_length_weeks must be between 1 and 260' }, { status: 400 });
  }

  if (manual_price_numeric != null) {
    const price = Number(manual_price_numeric);
    if (isNaN(price) || !isFinite(price) || price < 0 || price > 1_000_000) {
      return NextResponse.json({ error: 'manual_price_numeric must be a number between 0 and 1,000,000' }, { status: 400 });
    }
  }

  const admin    = createAdminClient();
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  let   clientId = '';

  // Enforce free client quota
  const { count: clientCount } = await admin
    .from('client_agreements')
    .select('id', { count: 'exact', head: true })
    .eq('pt_id', user.id);

  const quota = ptProfile?.free_client_quota ?? 3;
  if (typeof clientCount === 'number' && clientCount >= quota) {
    return NextResponse.json(
      { error: `You've reached your limit of ${quota} client${quota !== 1 ? 's' : ''}. Contact the platform owner to increase your quota.` },
      { status: 403 },
    );
  }

  // Invite the user — creates auth row + sends invite email
  const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data:       { full_name: cleanFullName },
    redirectTo: `${appUrl}/auth/callback`,
  });

  if (inviteErr) {
    if (inviteErr.message.toLowerCase().includes('already been registered') ||
        inviteErr.message.toLowerCase().includes('already exists')) {
      return NextResponse.json(
        { error: 'This email is already registered on Brigid. Each client can only be linked to one PT at a time. If they are moving to you from another coach, contact support.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: inviteErr.message }, { status: 400 });
  } else {
    clientId = invite.user.id;
  }

  // Upsert profile (trigger may have already created it with just email)
  await admin.from('profiles').upsert(
    { id: clientId, email, full_name: cleanFullName, role: 'client' },
    { onConflict: 'id' },
  );

  // Create agreement — upsert in case re-adding an existing client
  const { data: agreement, error: agErr } = await admin
    .from('client_agreements')
    .upsert({
      client_id:            clientId,
      pt_id:                user.id,
      status:               'active',
      agreement_model:      agreement_model      ?? 'subscription',
      start_date:           start_date           ?? new Date().toISOString().split('T')[0],
      renewal_date:         renewal_date         || null,
      program_length_weeks: parsedWeeks,
      manual_price_numeric: manual_price_numeric != null ? parseFloat(manual_price_numeric) : null,
      manual_currency:      manual_currency      ?? 'GBP',
    }, { onConflict: 'client_id,pt_id' })
    .select()
    .single();

  if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 });

  // ── Stripe integration ──────────────────────────────────
  // Only run if a price is set and Stripe is configured
  let stripeClientSecret: string | null = null;

  if (manual_price_numeric && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripeCustomerId = await getOrCreateCustomer(email, cleanFullName, agreement.id);

      // Store the customer ID immediately
      await admin
        .from('client_agreements')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', agreement.id);

      const amountPence = Math.round(parseFloat(manual_price_numeric) * 100);
      const currency    = manual_currency ?? 'GBP';

      if (agreement_model === 'subscription') {
        const sub = await createSubscription(stripeCustomerId, amountPence, currency, agreement.id);
        await admin
          .from('client_agreements')
          .update({ stripe_subscription_id: sub.id })
          .eq('id', agreement.id);
        // Return the client_secret so the PT can share a payment link
        const latestInvoice = sub.latest_invoice as { payment_intent?: { client_secret?: string } } | null;
        stripeClientSecret  = latestInvoice?.payment_intent?.client_secret ?? null;
      } else if (agreement_model === 'fixed_block') {
        const pi          = await createPaymentIntent(stripeCustomerId, amountPence, currency, agreement.id);
        stripeClientSecret = pi.client_secret;
      }
    } catch (stripeErr) {
      // Non-fatal — log and continue. Client is created, Stripe can be wired manually.
      console.error('[api/clients] Stripe error:', stripeErr);
    }
  }

  return NextResponse.json({ client_id: clientId, agreement, stripe_client_secret: stripeClientSecret }, { status: 201 });
}
