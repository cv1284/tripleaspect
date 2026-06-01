import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Programme, ClientRow } from '@/types/database';
import ProgrammeBuilder from '@/components/pt/ProgrammeBuilder';
import { isOnboardingComplete } from '@/types/database';
import { daysUntilRenewal } from '@/lib/utils';

interface Props { params: Promise<{ id: string }> }

export default async function ProgrammeBuilderPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'pt') redirect('/login');

  // Fetch programme with full tree
  const { data: programme, error } = await supabase
    .from('programmes')
    .select(`
      id, pt_id, title, description, category, total_weeks, is_public, created_at, updated_at,
      weeks:programme_weeks (
        id, week_number, label,
        sessions:programme_sessions (
          id, day_of_week, title, category, notes, sort_order, template_id,
          items:programme_session_items (
            id, exercise_id, sort_order, prescribed_metrics,
            custom_coaching_cues, custom_youtube_url,
            exercise:exercises ( id, name, category, coaching_cues, tags )
          )
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error || !programme) redirect('/pt/programmes');

  // Sort weeks and sessions
  if (programme.weeks) {
    (programme.weeks as Array<{ week_number: number; sessions?: Array<{ sort_order: number }> }>)
      .sort((a, b) => a.week_number - b.week_number)
      .forEach(w => w.sessions?.sort((a, b) => a.sort_order - b.sort_order));
  }

  // Fetch active clients for the Assign modal
  const { data: agreements } = await supabase
    .from('client_agreements')
    .select(`
      id, status, agreement_model, start_date, renewal_date, program_length_weeks,
      parq_signed, parq_storage_url, waiver_signed, waiver_storage_url,
      consent_signed, consent_storage_url,
      manual_price_numeric, manual_currency, billing_notes,
      stripe_customer_id, stripe_subscription_id,
      deletion_scheduled_at, deletion_reason,
      created_at, updated_at,
      client:profiles ( id, email, full_name, role, avatar_url, logo_url, created_at, updated_at )
    `)
    .eq('pt_id', user.id)
    .eq('status', 'active');

  type ClientProfile = { id: string; email: string; full_name: string | null; role: string; avatar_url: string | null; logo_url: string | null; created_at: string; updated_at: string };

  const clients: ClientRow[] = (agreements ?? []).map(a => {
    // Supabase returns joined 1:1 relations as a single object
    const c = a.client as unknown as ClientProfile;
    return {
      ...c,
      role: c.role as 'pt' | 'client',
      agreement: {
        id:                     a.id,
        client_id:              c.id,
        pt_id:                  user.id,
        status:                 a.status,
        agreement_model:        a.agreement_model,
        start_date:             a.start_date,
        renewal_date:           a.renewal_date,
        program_length_weeks:   a.program_length_weeks,
        parq_signed:            a.parq_signed,
        parq_storage_url:       a.parq_storage_url,
        waiver_signed:          a.waiver_signed,
        waiver_storage_url:     a.waiver_storage_url,
        consent_signed:         a.consent_signed,
        consent_storage_url:    a.consent_storage_url,
        manual_price_numeric:   a.manual_price_numeric,
        manual_currency:        a.manual_currency,
        billing_notes:          a.billing_notes,
        stripe_customer_id:     a.stripe_customer_id,
        stripe_subscription_id: a.stripe_subscription_id,
        deletion_scheduled_at:  a.deletion_scheduled_at,
        deletion_reason:        a.deletion_reason,
        created_at:             a.created_at,
        updated_at:             a.updated_at,
      },
      sessions_this_week:  0,
      days_until_renewal:  daysUntilRenewal(a.renewal_date),
      onboarding_complete: isOnboardingComplete(a as unknown as Parameters<typeof isOnboardingComplete>[0]),
    } as ClientRow;
  });

  return (
    <ProgrammeBuilder programme={programme as unknown as Programme} clients={clients} />
  );
}
