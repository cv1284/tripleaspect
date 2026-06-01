'use client';

import { useState } from 'react';
import { formatDistanceToNow, parseISO, subDays } from 'date-fns';
import { BugReport, bugRefLabel } from '@/types/database';

interface Props {
  initialReports: BugReport[];
}

const TYPE_CFG = {
  bug:     { icon: '🐛', label: 'Bug',     accent: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  feature: { icon: '💡', label: 'Feature', accent: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
} as const;

function ReportCard({
  report,
  onResolved,
}: {
  report:     BugReport;
  onResolved: (id: string, note: string) => void;
}) {
  const [resolvedNote, setResolvedNote] = useState('');
  const [resolving,    setResolving]    = useState(false);
  const [expanded,     setExpanded]     = useState(false);
  const cfg   = TYPE_CFG[report.report_type];
  const label = bugRefLabel(report);

  async function handleResolve() {
    setResolving(true);
    const res = await fetch(`/api/bug-reports/${report.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ resolved_note: resolvedNote }),
    });
    setResolving(false);
    if (res.ok) onResolved(report.id, resolvedNote);
  }

  return (
    <div className={`card overflow-hidden border ${report.status === 'resolved' ? 'border-surface-border opacity-70' : 'border-surface-border'}`}>
      {/* Header row */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-surface-3 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="text-base flex-shrink-0 mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-mono font-bold ${cfg.accent}`}>{label}</span>
            <span className={`text-2xs font-mono px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.accent} ${cfg.border} border`}>
              {cfg.label}
            </span>
            {report.status === 'resolved' && (
              <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Resolved
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-200 mt-0.5 truncate">{report.page_title}</p>
          <p className="text-2xs font-mono text-slate-600 mt-0.5">
            {report.user?.full_name ?? report.user?.email ?? '—'}
            {' · '}
            {formatDistanceToNow(parseISO(report.created_at), { addSuffix: true })}
          </p>
        </div>
        <span className="text-slate-600 text-xs flex-shrink-0 mt-1">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-surface-border pt-3">
          {report.notes && (
            <p className="text-sm text-slate-300 leading-relaxed">{report.notes}</p>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <p className="text-2xs font-mono text-slate-600">
              URL: <a href={report.url} className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer">{report.url}</a>
            </p>
            {report.user?.email && (
              <p className="text-2xs font-mono text-slate-600">User: {report.user.email}</p>
            )}
            {report.user_agent && (
              <p className="text-2xs font-mono text-slate-600 truncate max-w-xs">{report.user_agent}</p>
            )}
          </div>

          {report.screenshot_url && (
            <img
              src={report.screenshot_url}
              alt="Screenshot"
              className="max-h-48 rounded-lg border border-surface-border object-contain"
            />
          )}

          {report.status === 'resolved' ? (
            report.resolved_note && (
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                <p className="text-xs font-mono text-emerald-400 mb-1">Resolution note</p>
                <p className="text-sm text-slate-300">{report.resolved_note}</p>
              </div>
            )
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Resolution note (optional)…"
                value={resolvedNote}
                onChange={e => setResolvedNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleResolve()}
                className="input text-sm flex-1"
              />
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="btn-primary text-sm px-4 flex-shrink-0"
              >
                {resolving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Resolve'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BugReportsPanel({ initialReports }: Props) {
  const [reports, setReports] = useState<BugReport[]>(initialReports);

  function handleResolved(id: string, note: string) {
    setReports(prev => prev.map(r =>
      r.id === id
        ? { ...r, status: 'resolved', resolved_note: note, resolved_at: new Date().toISOString() }
        : r
    ));
  }

  const sevenDaysAgo = subDays(new Date(), 7);
  const open           = reports.filter(r => r.status === 'open');
  const recentResolved = reports.filter(r => r.status === 'resolved' && parseISO(r.resolved_at!) > sevenDaysAgo);
  const archived       = reports.filter(r => r.status === 'resolved' && parseISO(r.resolved_at!) <= sevenDaysAgo);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Bug Reports & Feature Requests</h2>
        <p className="text-sm font-mono text-slate-500 mt-0.5">
          {open.length} open · {recentResolved.length} recently resolved · {archived.length} archived
        </p>
      </div>

      {/* Open */}
      <section className="space-y-2">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
          Open <span className="text-slate-700">({open.length})</span>
        </p>
        {open.length === 0 ? (
          <p className="text-sm font-mono text-slate-600 py-4">All clear 🎉</p>
        ) : (
          open.map(r => <ReportCard key={r.id} report={r} onResolved={handleResolved} />)
        )}
      </section>

      {/* Recently resolved */}
      {recentResolved.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Recently Resolved <span className="text-slate-700">({recentResolved.length})</span>
          </p>
          {recentResolved.map(r => <ReportCard key={r.id} report={r} onResolved={handleResolved} />)}
        </section>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Archived <span className="text-slate-700">({archived.length})</span>
          </p>
          <div className="card overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-4 py-2 text-left label">Ref</th>
                  <th className="px-4 py-2 text-left label">Page</th>
                  <th className="px-4 py-2 text-left label">User</th>
                  <th className="px-4 py-2 text-left label">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {archived.map(r => (
                  <tr key={r.id} className="border-b border-surface-border/50">
                    <td className={`px-4 py-2 font-mono font-bold ${TYPE_CFG[r.report_type].accent}`}>
                      {bugRefLabel(r)}
                    </td>
                    <td className="px-4 py-2 text-slate-400 truncate max-w-xs">{r.page_title}</td>
                    <td className="px-4 py-2 text-slate-500">{r.user?.email ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600 font-mono">
                      {r.resolved_at ? formatDistanceToNow(parseISO(r.resolved_at), { addSuffix: true }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
