import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Programme, ProgrammeWeek, ProgrammeSession, ProgrammeSessionItem } from '@/types/database';

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const CATEGORY_LABELS: Record<string, string> = { healing: 'Healing', forging: 'Forging', verse: 'Verse' };
const CATEGORY_ICONS: Record<string, string>  = { healing: '◈', forging: '⬡', verse: '◎' };

function formatMetrics(m: Record<string, unknown> | null | undefined): string {
  if (!m) return '';
  const parts: string[] = [];
  if (m.sets)             parts.push(`${m.sets} sets`);
  if (m.reps)             parts.push(`${m.reps} reps`);
  if (m.weight_kg)        parts.push(`${m.weight_kg}kg`);
  if (m.rest_seconds)     parts.push(`${m.rest_seconds}s rest`);
  if (m.tempo)            parts.push(`tempo ${m.tempo}`);
  if (m.rpe)              parts.push(`RPE ${m.rpe}`);
  if (m.duration_minutes) parts.push(`${m.duration_minutes} min`);
  if (m.distance_km)      parts.push(`${m.distance_km}km`);
  if (m.hold_seconds)     parts.push(`${m.hold_seconds}s hold`);
  if (m.rounds)           parts.push(`${m.rounds} rounds`);
  return parts.join(' · ');
}

interface Props { params: Promise<{ id: string }> }

export default async function ProgrammePrintPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single();
  if (profile?.role !== 'pt') redirect('/login');

  const { data: programme } = await supabase
    .from('programmes')
    .select(`
      id, pt_id, title, description, category, total_weeks, created_at,
      weeks:programme_weeks (
        id, week_number, label,
        sessions:programme_sessions (
          id, day_of_week, title, category, notes, sort_order,
          items:programme_session_items (
            id, exercise_id, sort_order, prescribed_metrics,
            custom_coaching_cues,
            exercise:exercises ( id, name, category, coaching_cues )
          )
        )
      )
    `)
    .eq('id', id)
    .eq('pt_id', user.id)
    .single() as { data: Programme | null };

  if (!programme) redirect('/pt/programmes');

  const weeks = (programme.weeks ?? []).sort((a, b) => a.week_number - b.week_number);
  for (const week of weeks) {
    week.sessions?.sort((a, b) => a.sort_order - b.sort_order);
    for (const session of week.sessions ?? []) {
      session.items?.sort((a, b) => a.sort_order - b.sort_order);
    }
  }

  const catIcon = CATEGORY_ICONS[programme.category ?? ''] ?? '';
  const catLabel = CATEGORY_LABELS[programme.category ?? ''] ?? '';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        header, nav, footer, [class*="banner"], [class*="navigation"], [class*="nav-"], .chat-btn,
        button[class*="chat"], a[class*="chat"] { display: none !important; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: #1e293b !important; font-size: 11pt; -webkit-print-color-adjust: exact; }
          .print-page { background: white !important; color: #1e293b !important; }
        }
      `}} />

      <div className="print-page min-h-screen" style={{ maxWidth: 900, margin: '0 auto', padding: 24, background: 'white', color: '#1e293b', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: 1.5 }}>
        <div className="no-print" style={{ marginBottom: 24 }}>
          <button
            id="print-btn"
            style={{ display: 'inline-block', padding: '8px 20px', background: '#1e293b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.875rem', marginRight: 8 }}
          >
            Print / Save as PDF
          </button>
          <a
            href={`/pt/programmes/${id}`}
            style={{ display: 'inline-block', padding: '8px 20px', background: '#64748b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'none' }}
          >
            ← Back to Builder
          </a>
          <script dangerouslySetInnerHTML={{ __html: `document.getElementById('print-btn').onclick=()=>window.print()` }} />
        </div>

        <h1 style={{ fontSize: '1.75rem', margin: '0 0 4px', color: '#0f172a' }}>{catIcon} {programme.title}</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 16 }}>
          {catLabel} · {programme.total_weeks} week{programme.total_weeks !== 1 ? 's' : ''}
          {programme.description && <> · {programme.description}</>}
        </p>

        {weeks.map((week: ProgrammeWeek) => {
          const sessionsInWeek = (week.sessions ?? []).filter((s: ProgrammeSession) => s.title);
          if (sessionsInWeek.length === 0) return null;

          return (
            <div key={week.id}>
              <h2 style={{ fontSize: '1.25rem', margin: '24px 0 8px', paddingBottom: 4, borderBottom: '2px solid #e2e8f0', color: '#1e293b' }}>
                Week {week.week_number}{week.label ? ` — ${week.label}` : ''}
              </h2>

              {sessionsInWeek.map((session: ProgrammeSession) => (
                <div key={session.id} style={{ margin: '8px 0', padding: '8px 12px', background: '#f8fafc', borderRadius: 6 }}>
                  <h3 style={{ fontSize: '1rem', margin: '4px 0', color: '#475569' }}>
                    {CATEGORY_ICONS[session.category] ?? ''}{' '}
                    {DAY_NAMES[session.day_of_week] ?? `Day ${session.day_of_week}`}: {session.title}
                  </h3>
                  {session.notes && <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', margin: '2px 0' }}>{session.notes}</p>}

                  {(session.items ?? []).map((item: ProgrammeSessionItem, idx: number) => (
                    <div key={item.id} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{idx + 1}. {item.exercise?.name ?? 'Unknown Exercise'}</span>
                      {item.prescribed_metrics && (
                        <span style={{ color: '#64748b', fontSize: '0.875rem' }}> — {formatMetrics(item.prescribed_metrics as Record<string, unknown>)}</span>
                      )}
                      {(item.custom_coaching_cues || item.exercise?.coaching_cues) && (
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', marginTop: 2 }}>
                          {item.custom_coaching_cues || item.exercise?.coaching_cues}
                        </div>
                      )}
                    </div>
                  ))}

                  {(!session.items || session.items.length === 0) && (
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No exercises assigned</p>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {weeks.every((w: ProgrammeWeek) => !(w.sessions ?? []).some((s: ProgrammeSession) => s.title)) && (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '32px 0' }}>
            No sessions in this programme yet. Add sessions in the builder first.
          </p>
        )}

        <div style={{ marginTop: 32, paddingTop: 12, borderTop: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>
          Generated by brigid.pro · {profile.full_name ?? 'PT'} · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </>
  );
}
