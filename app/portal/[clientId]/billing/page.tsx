import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Invoice } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface Props { params: Promise<{ clientId: string }> }

export default async function ClientBillingPage({ params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== clientId) redirect('/login');

  const admin = createAdminClient();

  // Get the client's agreement
  const { data: agreement } = await admin
    .from('client_agreements')
    .select('id')
    .eq('client_id', clientId)
    .single();

  const invoices: Invoice[] = [];

  if (agreement) {
    const { data } = await admin
      .from('invoices')
      .select('id, amount_pence, currency, status, paid_at, created_at')
      .eq('agreement_id', agreement.id)
      .order('created_at', { ascending: false });
    invoices.push(...((data ?? []) as unknown as Invoice[]));
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-28 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Billing</h1>
        <p className="text-sm font-mono text-slate-500 mt-1">Your payment history.</p>
      </div>

      {invoices.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-surface-border rounded-xl">
          <p className="text-slate-600 font-mono text-sm">No invoices yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(invoice => (
            <div key={invoice.id} className="card p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {formatCurrency(invoice.amount_pence / 100, invoice.currency)}
                </p>
                <p className="text-2xs font-mono text-slate-500 mt-0.5">
                  {format(parseISO(invoice.paid_at ?? invoice.created_at), 'd MMM yyyy')}
                </p>
              </div>
              <StatusBadge status={invoice.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    paid:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    failed:  'bg-red-500/10 text-red-400 border-red-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }[status] ?? 'bg-surface-3 text-slate-500 border-surface-border';

  return (
    <span className={`text-2xs font-mono px-2 py-0.5 rounded border ${cfg}`}>
      {status}
    </span>
  );
}
