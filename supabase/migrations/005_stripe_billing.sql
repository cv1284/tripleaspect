-- Migration 005: invoices table for Stripe payment tracking

CREATE TABLE IF NOT EXISTS invoices (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id              UUID NOT NULL REFERENCES client_agreements(id) ON DELETE CASCADE,
  stripe_invoice_id         TEXT,
  stripe_payment_intent_id  TEXT,
  amount_pence              INTEGER NOT NULL,
  currency                  VARCHAR(3) NOT NULL DEFAULT 'GBP',
  status                    TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'failed'
  paid_at                   TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_agreement_id_idx ON invoices (agreement_id);
CREATE INDEX IF NOT EXISTS invoices_stripe_invoice_id_idx ON invoices (stripe_invoice_id);

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- PT can read invoices for their own agreements
CREATE POLICY "PT reads own invoices" ON invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM client_agreements ca
      WHERE ca.id = invoices.agreement_id
        AND ca.pt_id = auth.uid()
    )
  );

-- Client can read their own invoices
CREATE POLICY "Client reads own invoices" ON invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM client_agreements ca
      WHERE ca.id = invoices.agreement_id
        AND ca.client_id = auth.uid()
    )
  );

-- Service role can insert (webhooks use service role)
CREATE POLICY "Service role inserts invoices" ON invoices
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role updates invoices" ON invoices
  FOR UPDATE USING (true);
