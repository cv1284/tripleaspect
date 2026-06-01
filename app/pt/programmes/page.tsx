import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Programme } from '@/types/database';
import { CATEGORY_CONFIG } from '@/lib/utils';
import { SessionCategory } from '@/types/database';
import { format, parseISO } from 'date-fns';

export default async function ProgrammesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'pt') redirect('/login');

  const { data } = await supabase
    .from('programmes')
    .select('id, pt_id, title, description, category, total_weeks, is_public, created_at, updated_at')
    .order('created_at', { ascending: false });

  const programmes = (data ?? []) as Programme[];
  const mine   = programmes.filter(p => p.pt_id === user.id);
  const public_ = programmes.filter(p => p.is_public && p.pt_id !== user.id);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28 space-y-8">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Programmes</h1>
          <p className="text-sm font-mono text-slate-500 mt-1">
            Multi-week coaching blueprints. Build a programme, then assign it to any client.
          </p>
        </div>
        <NewProgrammeButton />
      </div>

      {/* My programmes */}
      <section className="space-y-3">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
          My Programmes <span className="text-slate-700">({mine.length})</span>
        </p>

        {mine.length === 0 && (
          <div className="py-12 text-center border border-dashed border-surface-border rounded-xl">
            <p className="text-slate-600 font-mono text-sm">No programmes yet.</p>
            <p className="text-slate-700 font-mono text-xs mt-1">Create one to start building multi-week plans.</p>
          </div>
        )}

        {mine.map(p => <ProgrammeCard key={p.id} programme={p} />)}
      </section>

      {/* Public library */}
      {public_.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Public Library <span className="text-slate-700">({public_.length})</span>
          </p>
          {public_.map(p => <ProgrammeCard key={p.id} programme={p} readOnly />)}
        </section>
      )}
    </div>
  );
}

function ProgrammeCard({ programme: p, readOnly }: { programme: Programme; readOnly?: boolean }) {
  const cfg = p.category ? CATEGORY_CONFIG[p.category as SessionCategory] : null;
  return (
    <Link
      href={readOnly ? '#' : `/pt/programmes/${p.id}`}
      className="card p-4 flex items-center gap-4 hover:bg-surface-3 transition-colors"
    >
      <span className={`text-2xl flex-shrink-0 ${cfg?.color ?? 'text-slate-500'}`}>
        {cfg?.icon ?? '⊟'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-200">{p.title}</p>
          {p.is_public && (
            <span className="text-2xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Public
            </span>
          )}
        </div>
        <p className="text-2xs font-mono text-slate-600 mt-0.5">
          {p.total_weeks} week{p.total_weeks !== 1 ? 's' : ''}
          {cfg && ` · ${cfg.label}`}
          {' · '}
          {format(parseISO(p.created_at), 'd MMM yyyy')}
        </p>
        {p.description && (
          <p className="text-xs font-mono text-slate-500 mt-1 truncate">{p.description}</p>
        )}
      </div>
      {!readOnly && (
        <span className="text-slate-600 text-sm flex-shrink-0">→</span>
      )}
    </Link>
  );
}

function NewProgrammeButton() {
  return (
    <Link href="/pt/programmes/new" className="btn-primary text-sm">
      + New Programme
    </Link>
  );
}
