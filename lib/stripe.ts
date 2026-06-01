import Stripe from 'stripe';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any });

// Returns an existing Stripe customer ID or creates a new one.
export async function getOrCreateCustomer(
  email:       string,
  name:        string | null,
  agreementId: string,
): Promise<string> {
  // Check if a customer already exists with this email
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  const customer = await stripe.customers.create({
    email,
    name:     name ?? undefined,
    metadata: { agreement_id: agreementId },
  });
  return customer.id;
}

// Creates a monthly subscription for a customer.
// amount is in the smallest currency unit (pence / cents).
export async function createSubscription(
  customerId:  string,
  amountPence: number,
  currency:    string,
  agreementId: string,
): Promise<Stripe.Subscription> {
  // Create an inline price so the PT doesn't need to pre-configure Stripe products
  const price = await stripe.prices.create({
    currency:    currency.toLowerCase(),
    unit_amount: amountPence,
    recurring:   { interval: 'month' },
    product_data: { name: 'Coaching subscription' },
  });

  return stripe.subscriptions.create({
    customer:          customerId,
    items:             [{ price: price.id }],
    payment_behavior:  'default_incomplete',
    payment_settings:  { save_default_payment_method: 'on_subscription' },
    expand:            ['latest_invoice.payment_intent'],
    metadata:          { agreement_id: agreementId },
  });
}

// Creates a one-time PaymentIntent for a fixed-block agreement.
export async function createPaymentIntent(
  customerId:  string,
  amountPence: number,
  currency:    string,
  agreementId: string,
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount:               amountPence,
    currency:             currency.toLowerCase(),
    customer:             customerId,
    setup_future_usage:   'off_session',
    automatic_payment_methods: { enabled: true },
    metadata:             { agreement_id: agreementId },
  });
}
