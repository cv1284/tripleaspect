import { createClient }      from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { Session, ClientAgreement, Profile, SessionCategory, isOnboardingComplete } from '@/types/database';
import SessionView       from '@/components/client/SessionView';
import PortalBanners     from '@/components/client/PortalBanners';
import ClientOnboarding  from '@/components/client/ClientOnboarding';
import PortalNav         from '@/components/client/PortalNav';
import { CompletionStreak, WellbeingTrend } from '@/components/client/PortalStats';
import { CATEGORY_CONFIG } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

// ─── Verse rest-day activity suggestions ──────────────────

const VERSE_ACTIVITIES = [
  { name: 'Box Breathing',      duration: '5–10 min',  description: '4 counts in · 4 hold · 4 out · 4 hold. Resets the nervous system fast.' },
  { name: 'Gratitude Journal',  duration: '5 min',     description: 'Write three things you\'re grateful for today. Small habit, big compound effect.' },
  { name: 'Zone 2 Walk',        duration: '20–40 min', description: 'Conversational-pace walking. Keeps aerobic base ticking without taxing recovery.' },
  { name: 'Swimming',           duration: '20–30 min', description: 'Light laps or water movement. Unloads joints while circulation stays high.' },
  { name: 'Yoga or Mobility',   duration: '15–30 min', description: 'Gentle movement through full range. Feeds recovery and builds body awareness.' },
  { name: 'Meditation',         duration: '5–15 min',  description: 'Sit, close your eyes, follow your breath. Even 5 minutes shifts your state.' },
  { name: 'Cold Shower',        duration: '60–90 sec', description: 'Finish your shower cold. Sharpens focus and accelerates muscle recovery.' },
  { name: 'Body Scan',          duration: '10–15 min', description: 'Lie still and move attention slowly through each part of your body. Powerful stress reset.' },
  { name: 'Journaling',         duration: '10 min',    description: 'Free-write whatever is on your mind. Clears mental noise and surfaces patterns.' },
  { name: 'Nature Walk',        duration: '20–30 min', description: 'Green spaces lower cortisol measurably. Leave the phone in your pocket.' },
] as const;

function getDailyVerseIdeas(date: Date, count = 3) {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const n = VERSE_ACTIVITIES.length;
  return Array.from({ length: count }, (_, i) =>
    VERSE_ACTIVITIES[(dayOfYear + i * Math.ceil(n / count)) % n],
  );
}

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function ClientPortalPage({ params }: Props) {
  const { clientId } = await params;
  const supabase     = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: viewer } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isOwnPortal = user.id === clientId;
  const isPT        = viewer?.role === 'pt';

  if (!isOwnPortal && !isPT) redirect('/login');

  // Use admin client to fetch the client profile — the pt_reads_clients RLS policy
  // can silently block profile reads for invited-but-unconfirmed clients (same quirk
  // handled by the admin fallback in the PT clients page).
  // PTs are gated by the agreement check below; clients can only see their own portal.
  const admin = createAdminClient();

  if (isPT && !isOwnPortal) {
    const { data: agreement } = await supabase
      .from('client_agreements')
      .select('id')
      .eq('pt_id', user.id)
      .eq('client_id', clientId)
      .single();
    if (!agreement) redirect('/login');
  }

  const { data: client } = await admin
    .from('profiles')
    .select('*')
    .eq('id', clientId)
    .single();

  if (!client) notFound();

  const { data: agreement } = await supabase
    .from('client_agreements')
    .select('*, pt:profiles!client_agreements_pt_id_fkey(email, full_name)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const today = format(new Date(), 'yyyy-MM-dd');

  // Today's session only
  const { data: todaySessions } = await supabase
    .from('sessions')
    .select(`*, session_items(*, exercise:exercises(*))`)
    .eq('client_id', clientId)
    .eq('scheduled_date', today)
    .order('created_at', { ascending: false })
    .limit(1);

  // If no session today, look ahead for the next upcoming one (for the rest-day hint)
  const { data: upcomingSessions } = !todaySessions?.length
    ? await supabase
        .from('sessions')
        .select('id, title, scheduled_date, category')
        .eq('client_id', clientId)
        .gt('scheduled_date', today)
        .order('scheduled_date', { ascending: true })
        .limit(1)
    : { data: null };

  const session    = todaySessions?.[0] ?? null;
  const nextUp     = upcomingSessions?.[0] ?? null;

  // ── Completion streak ────────────────────────────────────
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('scheduled_date, completed_at')
    .eq('client_id', clientId)
    .lte('scheduled_date', today)
    .order('scheduled_date', { ascending: false })
    .limit(60);

  let streak = 0;
  if (recentSessions) {
    for (const s of recentSessions) {
      if (s.completed_at) streak++;
      else break;
    }
  }

  // ── Recent wellbeing check-ins (trend) ───────────────────
  const { data: recentCheckins } = await supabase
    .from('wellbeing_checkins')
    .select('sleep, stress, soreness, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(7);

  const { data: existingCheckin } = session
    ? await supabase
        .from('wellbeing_checkins')
        .select('id')
        .eq('session_id', session.id)
        .eq('client_id', clientId)
        .maybeSingle()
    : { data: null };
  const ptData     = (agreement as unknown as { pt?: { email: string; full_name: string | null } })?.pt;
  const ptEmail    = ptData?.email;
  const ptName     = ptData?.full_name ?? undefined;
  const firstName  = client.full_name?.split(' ')[0] ?? 'there';

  if (!agreement) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-2xl">◎</p>
          <p className="text-slate-400 font-medium">No active agreement found.</p>
          <p className="text-slate-600 text-sm font-mono">Contact your coach to get started.</p>
        </div>
      </div>
    );
  }

  // Onboarding incomplete — show the guided doc-signing experience instead of the portal
  if (!isOnboardingComplete(agreement as ClientAgreement)) {
    return (
      <ClientOnboarding
        agreement={agreement as ClientAgreement}
        firstName={firstName}
        ptEmail={ptEmail}
        ptName={ptName}
      />
    );
  }

  // Rest day — no session scheduled today
  if (!session) {
    const nextUpCfg    = nextUp ? CATEGORY_CONFIG[nextUp.category as SessionCategory] : null;
    const nextUpDate   = nextUp?.scheduled_date
      ? format(parseISO(nextUp.scheduled_date), 'EEEE d MMMM')
      : null;
    const verseIdeas   = getDailyVerseIdeas(new Date());

    return (
      <div className="min-h-screen bg-surface-0">
        <header className="sticky top-0 bg-surface-0/90 backdrop-blur-md border-b border-surface-border z-20">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <span className="font-mono font-bold text-sm">
              <span className="text-emerald-400">◈</span>
              <span className="text-amber-400"> ⬡</span>
              <span className="text-indigo-400"> ◎</span>
              <span className="text-slate-300 ml-2">brigid.pro</span>
            </span>
            <span className="text-xs font-mono text-slate-500">{firstName}</span>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-5">
          <PortalBanners agreement={agreement as ClientAgreement} ptEmail={ptEmail} />

          <CompletionStreak streak={streak} />
          <WellbeingTrend checkins={recentCheckins ?? []} />

          {/* Rest day hero */}
          <div className="py-8 text-center space-y-2">
            <p className="text-5xl mb-4">◈</p>
            <h1 className="text-2xl font-bold text-slate-100">Rest Day</h1>
            <p className="text-slate-400 font-mono text-sm">
              Rest well, {firstName}. Recovery is training.
            </p>
          </div>

          {/* Verse ideas */}
          <div className="rounded-xl bg-surface-2 border border-indigo-500/20 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-indigo-500/15 flex items-center gap-2">
              <span className="text-indigo-400 text-sm">◎</span>
              <p className="text-xs font-mono text-indigo-400 uppercase tracking-widest">Verse — today&apos;s rest ideas</p>
            </div>
            <div className="divide-y divide-surface-border">
              {verseIdeas.map(activity => (
                <div key={activity.name} className="px-4 py-3.5 flex items-start gap-3">
                  <span className="text-indigo-400/50 text-lg leading-none mt-0.5 flex-shrink-0">◎</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="text-sm font-semibold text-slate-200">{activity.name}</p>
                      <span className="text-2xs font-mono text-indigo-400/60">{activity.duration}</span>
                    </div>
                    <p className="text-xs font-mono text-slate-500 mt-0.5 leading-relaxed">
                      {activity.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-indigo-500/15 bg-indigo-500/5">
              <p className="text-2xs font-mono text-indigo-400/50 text-center">
                Always check with your PT before starting any new activity.
              </p>
            </div>
          </div>

          {/* Next session card */}
          {nextUp && nextUpDate && nextUpCfg ? (
            <div className="rounded-xl bg-surface-2 border border-surface-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface-border">
                <p className="text-2xs font-mono text-slate-600 uppercase tracking-widest">Next session</p>
              </div>
              <div className="px-4 py-4 flex items-center gap-3">
                <span className={`text-2xl ${nextUpCfg.color}`}>{nextUpCfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{nextUp.title}</p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">{nextUpDate}</p>
                </div>
                <span className={`text-2xs font-mono px-2 py-1 rounded-md border ${nextUpCfg.bg} ${nextUpCfg.color} border-current/20`}>
                  {nextUpCfg.label}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-surface-2 border border-surface-border px-4 py-4 text-center">
              <p className="text-xs font-mono text-slate-600">No upcoming sessions scheduled yet.</p>
              <p className="text-2xs font-mono text-slate-700 mt-1">Your coach will add sessions to your programme soon.</p>
            </div>
          )}

          {/* Contact coach */}
          {ptEmail && (
            <div className="rounded-xl bg-surface-2 border border-surface-border px-4 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-300">
                  {ptName ?? 'Your coach'}
                </p>
                <p className="text-xs font-mono text-slate-600 mt-0.5">Questions or updates?</p>
              </div>
              <a
                href={`mailto:${ptEmail}`}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500 text-xs font-medium transition-colors"
              >
                ✉ Message
              </a>
            </div>
          )}
        </main>

        <PortalNav clientId={clientId} />
      </div>
    );
  }

  return (
    <>
      <SessionView
        session={session as Session}
        agreement={agreement as ClientAgreement}
        client={client as Profile}
        ptEmail={ptEmail}
        hasCheckin={!!existingCheckin}
        streak={streak}
        recentCheckins={recentCheckins ?? []}
      />
      <PortalNav clientId={clientId} />
    </>
  );
}
