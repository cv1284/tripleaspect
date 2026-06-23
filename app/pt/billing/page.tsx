import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Invoice } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'pt') redirect('/login');

  const admin = createAdminClient();

  // Fetch all invoices for this PT's agreements, with client name
  const { data: invoices } = await admin
    .from('invoices')
    .select(`
      id, agreement_id, stripe_invoice_id, amount_pence, currency,
      status, paid_at, created_at,
      agreement:client_agreements (
        client:profiles ( full_name, email )
      )
    `)
    .in(
      'agreement_id',
      (await admin
        .from('client_agreements')
        .select('id')
        .eq('pt_id', user.id)
        .then(r => (r.data ?? []).map(a => a.id)))
    )
    .order('created_at', { ascending: false });

  const rows = (invoices ?? []) as unknown as Invoice[];

  const totalPaid = rows
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + i.amount_pence, 0);

  const { data: agreements } = await supabase
    .from('client_agreements')
    .select('id, status, agreement_model, manual_price_numeric, currency, client_id, client:profiles!client_agreements_client_id_fkey(full_name)')
    .eq('pt_id', user.id);

  const activeAgreements = (agreements ?? []).filter(a => a.status === 'active');
  const subAgreements    = activeAgreements.filter(a => a.agreement_model === 'subscription');
  const mrr              = subAgreements.reduce((sum, a) => sum + (a.manual_price_numeric ?? 0), 0);
  const totalActiveRev   = activeAgreements.reduce((sum, a) => sum + (a.manual_price_numeric ?? 0), 0);
  const avgPerClient     = activeAgreements.length > 0 ? totalActiveRev / activeAgreements.length : 0;
  const defaultCurrency  = activeAgreements[0]?.currency ?? 'GBP';
  const currencySymbol   = defaultCurrency === 'GBP' ? '£' : defaultCurrency === 'USD' ? '$' : defaultCurrency === 'EUR' ? '€' : '';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-28 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Billing</h1>
        <p className="text-sm font-mono text-slate-500 mt-1">
          Revenue overview and invoice history.
        </p>
      </div>

      {/* Revenue overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Monthly recurring" value={`${currencySymbol}${mrr.toFixed(2)}`} sublabel={`${subAgreements.length} subscription${subAgreements.length !== 1 ? 's' : ''}`} />
        <StatCard label="Active clients"    value={activeAgreements.length.toString()} sublabel={`${(agreements ?? []).length} total`} />
        <StatCard label="Avg / client"      value={`${currencySymbol}${avgPerClient.toFixed(2)}`} sublabel="per month" />
        <StatCard label="Total collected"   value={`${currencySymbol}${(totalPaid / 100).toFixed(2)}`} sublabel={`${rows.filter(i => i.status === 'paid').length} paid`} />
      </div>

      {/* Per-client revenue table */}
      {activeAgreements.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <p className="label">Active client revenue</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="px-4 py-2.5 text-left label">Client</th>
                <th className="px-4 py-2.5 text-left label">Model</th>
                <th className="px-4 py-2.5 text-right label">Monthly rate</th>
              </tr>
            </thead>
            <tbody>
              {activeAgreements
                .sort((a, b) => (b.manual_price_numeric ?? 0) - (a.manual_price_numeric ?? 0))
                .map(ag => {
                  const clientName = (ag.client as unknown as { full_name: string | null })?.full_name ?? '—';
                  const model = ag.agreement_model === 'subscription' ? 'SUB' : ag.agreement_model === 'fixed_block' ? 'BLOCK' : 'HYBRID';
                  return (
                    <tr key={ag.id} className="border-b border-surface-border/50 hover:bg-surface-2 transition-colors">
                      <td className="px-4 py-2.5 text-slate-300 font-medium">{clientName}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-2xs font-mono px-2 py-0.5 rounded bg-surface-3 text-slate-500 border border-surface-border">{model}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                        {formatCurrency(ag.manual_price_numeric ?? 0, ag.currency ?? 'GBP')}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice history */}
      <div>
        <p className="label mb-3">Invoice history</p>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard label="Paid invoices" value={rows.filter(i => i.status === 'paid').length.toString()} />
          <StatCard label="Pending"       value={rows.filter(i => i.status === 'pending').length.toString()} />
          <StatCard label="Failed"        value={rows.filter(i => i.status === 'failed').length.toString()} accent="red" />
        </div>
      </div>

      {/* Invoice table */}
      {rows.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-surface-border rounded-xl">
          <p className="text-slate-600 font-mono text-sm">No invoices yet.</p>
          <p className="text-slate-700 font-mono text-xs mt-1">
            Stripe invoices will appear here once clients make payments.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="px-4 py-3 text-left label">Client</th>
                <th className="px-4 py-3 text-left label">Date</th>
                <th className="px-4 py-3 text-right label">Amount</th>
                <th className="px-4 py-3 text-left label">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(invoice => {
                const ag  = invoice.agreement as unknown as { client?: { full_name: string | null; email: string } } | null;
                const clientName = ag?.client?.full_name ?? ag?.client?.email ?? '—';
                return (
                  <tr key={invoice.id} className="border-b border-surface-border/50 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 text-slate-300 font-medium">{clientName}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                      {format(parseISO(invoice.paid_at ?? invoice.created_at), 'd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-200">
                      {formatCurrency(invoice.amount_pence / 100, invoice.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={invoice.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sublabel, accent }: { label: string; value: string; sublabel?: string; accent?: 'red' }) {
  return (
    <div className="card p-4">
      <p className="label mb-1">{label}</p>
      <p className={`text-2xl font-mono font-bold ${accent === 'red' ? 'text-red-400' : 'text-slate-100'}`}>
        {value}
      </p>
      {sublabel && <p className="text-2xs font-mono text-slate-600 mt-1">{sublabel}</p>}
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
