import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

// Stripe SDK types vary by version — use a local interface for the fields we need
interface StripeInvoice {
  id:             string;
  subscription:   string | null;
  payment_intent: string | null;
  amount_paid:    number;
  amount_due:     number;
  currency:       string;
  metadata:       Record<string, string>;
}

// Disable body parsing — Stripe requires the raw body for signature verification
export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook signature verification failed';
    console.error('[stripe/webhook] verification failed:', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as unknown as StripeInvoice;
      const agreementId = invoice.subscription
        ? await getAgreementIdFromSubscription(invoice.subscription as string)
        : (invoice.metadata?.agreement_id ?? null);

      if (agreementId) {
        await supabase.from('invoices').insert({
          agreement_id:             agreementId,
          stripe_invoice_id:        invoice.id,
          stripe_payment_intent_id: invoice.payment_intent as string | null,
          amount_pence:             invoice.amount_paid,
          currency:                 invoice.currency.toUpperCase(),
          status:                   'paid',
          paid_at:                  new Date().toISOString(),
        });
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as unknown as StripeInvoice;
      const agreementId = invoice.subscription
        ? await getAgreementIdFromSubscription(invoice.subscription as string)
        : (invoice.metadata?.agreement_id ?? null);

      if (agreementId) {
        await supabase.from('invoices').insert({
          agreement_id:             agreementId,
          stripe_invoice_id:        invoice.id,
          stripe_payment_intent_id: invoice.payment_intent as string | null,
          amount_pence:             invoice.amount_due,
          currency:                 invoice.currency.toUpperCase(),
          status:                   'failed',
        });
        // Flag the agreement so the PT is alerted in the dashboard
        await supabase
          .from('client_agreements')
          .update({ status: 'attention' })
          .eq('id', agreementId);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await supabase
        .from('client_agreements')
        .update({ status: 'inactive' })
        .eq('stripe_subscription_id', sub.id);
      break;
    }

    case 'customer.subscription.updated': {
      const sub    = event.data.object as Stripe.Subscription;
      const status = sub.status === 'active' ? 'active'
                   : sub.status === 'past_due' ? 'attention'
                   : sub.status === 'paused'   ? 'paused'
                   : null;
      if (status) {
        await supabase
          .from('client_agreements')
          .update({ status })
          .eq('stripe_subscription_id', sub.id);
      }
      break;
    }

    default:
      // Unhandled event — acknowledge but do nothing
      break;
  }

  return NextResponse.json({ received: true });
}

async function getAgreementIdFromSubscription(subscriptionId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('client_agreements')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();
  return data?.id ?? null;
}
