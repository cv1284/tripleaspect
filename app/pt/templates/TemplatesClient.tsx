'use client';

import { useState } from 'react';
import Image from 'next/image';
import { SessionTemplate, SessionCategory } from '@/types/database';
import { CATEGORY_CONFIG, formatMetricsSummary, getInitials } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface Props {
  ptId:             string;
  initialTemplates: SessionTemplate[];
}

export default function TemplatesClient({ ptId, initialTemplates }: Props) {
  const [templates,     setTemplates]     = useState<SessionTemplate[]>(initialTemplates);
  const [togglingId,    setTogglingId]    = useState<string | null>(null);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [search,        setSearch]        = useState('');
  const [catFilter,     setCatFilter]     = useState<SessionCategory | 'all'>('all');

  const myTemplates      = templates.filter(t => t.pt_id === ptId);
  const publicFromOthers = templates.filter(t => t.is_public && t.pt_id !== ptId);

  function applyFilters(list: SessionTemplate[]) {
    return list.filter(t => {
      if (catFilter !== 'all' && t.category !== catFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          t.template_items?.some(i => i.exercise?.name.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }

  const filteredMine   = applyFilters(myTemplates);
  const filteredPublic = applyFilters(publicFromOthers);

  async function togglePublic(id: string, current: boolean) {
    setTogglingId(id);
    const res = await fetch(`/api/templates/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_public: !current }),
    });
    setTogglingId(null);
    if (res.ok) {
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_public: !current } : t));
    }
  }

  async function deleteTemplate(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setDeletingId(id);
    setConfirmDelete(null);
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    if (res.ok) setTemplates(prev => prev.filter(t => t.id !== id));
  }

  async function duplicateTemplate(id: string) {
    setDuplicatingId(id);
    const res = await fetch(`/api/templates/${id}/duplicate`, { method: 'POST' });
    setDuplicatingId(null);
    if (res.ok) {
      const copy = await res.json();
      setTemplates(prev => [copy, ...prev]);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Session Templates</h1>
        <p className="text-sm font-mono text-slate-500 mt-1">
          Reusable session blueprints. Build from the session builder using &ldquo;Save as Template&rdquo;, then load them into any new session.
        </p>
      </div>

      {/* Search + category filter */}
      <div className="space-y-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm select-none">⌕</span>
          <input
            type="text"
            placeholder="Search templates, exercises..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-8"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'healing', 'forging', 'verse'] as const).map(c => {
            const cfg = c === 'all' ? null : CATEGORY_CONFIG[c];
            return (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`px-3 py-1 rounded-full text-2xs font-mono transition-colors ${
                  catFilter === c
                    ? c === 'all' ? 'bg-slate-600 text-white' : `${cfg!.bg} ${cfg!.color}`
                    : 'text-slate-500 hover:text-slate-300 bg-surface-3'
                }`}
              >
                {c === 'all' ? 'ALL' : cfg!.label.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* My Templates */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">My Templates</p>
          <span className="text-xs font-mono text-slate-700">
            ({filteredMine.length}{filteredMine.length !== myTemplates.length ? `/${myTemplates.length}` : ''})
          </span>
        </div>

        {myTemplates.length === 0 && (
          <div className="py-12 text-center border border-dashed border-surface-border rounded-xl">
            <p className="text-slate-600 font-mono text-sm">No templates yet.</p>
            <p className="text-slate-700 font-mono text-xs mt-1">
              Open the session builder, add exercises, then click &ldquo;Save as Template&rdquo;.
            </p>
          </div>
        )}

        {myTemplates.length > 0 && filteredMine.length === 0 && (
          <p className="text-sm font-mono text-slate-600 py-4 text-center">No templates match your search.</p>
        )}

        {filteredMine.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            isOwn={true}
            togglingId={togglingId}
            deletingId={deletingId}
            confirmDelete={confirmDelete}
            duplicatingId={duplicatingId}
            onTogglePublic={() => togglePublic(t.id, t.is_public)}
            onDelete={() => deleteTemplate(t.id)}
            onCancelDelete={() => setConfirmDelete(null)}
            onDuplicate={() => duplicateTemplate(t.id)}
          />
        ))}
      </section>

      {/* Public Library */}
      {publicFromOthers.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Public Library</p>
            <span className="text-xs font-mono text-slate-700">
              ({filteredPublic.length}{filteredPublic.length !== publicFromOthers.length ? `/${publicFromOthers.length}` : ''})
            </span>
          </div>
          <p className="text-xs font-mono text-slate-600">
            Templates shared by other PTs. Load them into the session builder to adapt for your clients.
          </p>
          {filteredPublic.length === 0 && (
            <p className="text-sm font-mono text-slate-600 py-4 text-center">No templates match your search.</p>
          )}
          {filteredPublic.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              isOwn={false}
              togglingId={togglingId}
              deletingId={deletingId}
              confirmDelete={confirmDelete}
              duplicatingId={duplicatingId}
              onTogglePublic={() => {}}
              onDelete={() => {}}
              onCancelDelete={() => {}}
              onDuplicate={() => duplicateTemplate(t.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

// ─── Template Card ─────────────────────────────────────────

function TemplateCard({
  template, isOwn,
  togglingId, deletingId, confirmDelete, duplicatingId,
  onTogglePublic, onDelete, onCancelDelete, onDuplicate,
}: {
  template:       SessionTemplate;
  isOwn:          boolean;
  togglingId:     string | null;
  deletingId:     string | null;
  confirmDelete:  string | null;
  duplicatingId:  string | null;
  onTogglePublic: () => void;
  onDelete:       () => void;
  onCancelDelete: () => void;
  onDuplicate:    () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const cfg           = CATEGORY_CONFIG[template.category as SessionCategory];
  const count         = template.template_items?.length ?? 0;
  const isToggling    = togglingId   === template.id;
  const isDeleting    = deletingId   === template.id;
  const isConfirm     = confirmDelete === template.id;
  const isDuplicating = duplicatingId === template.id;

  const sortedItems = [...(template.template_items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return (
    <div className={`card overflow-hidden transition-all ${expanded ? 'ring-1 ring-indigo-500/20' : ''}`}>
      {/* Header row — clickable to expand */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-surface-3/50 transition-colors select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <span className={`text-xl leading-none mt-0.5 flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-200">{template.title}</p>
            <span className={`text-2xs font-mono px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
            {template.is_public && (
              <span className="text-2xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Public
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-2xs font-mono text-slate-600">
              {count} exercise{count !== 1 ? 's' : ''}
              {' · '}
              {format(parseISO(template.created_at), 'd MMM yyyy')}
            </p>
            {!isOwn && template.pt_name && (
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full overflow-hidden bg-surface-4 border border-surface-border flex-shrink-0 flex items-center justify-center">
                  {template.pt?.logo_url ? (
                    <Image src={template.pt.logo_url!} alt={template.pt_name} width={16} height={16} className="object-cover w-full h-full" unoptimized />
                  ) : (
                    <span className="text-2xs font-mono text-slate-500">{getInitials(template.pt_name)[0]}</span>
                  )}
                </span>
                <span className="text-2xs font-mono text-indigo-400/80">{template.pt_name}</span>
              </span>
            )}
          </div>

          {template.notes && (
            <p className="text-xs font-mono text-slate-500 leading-relaxed">{template.notes}</p>
          )}
        </div>

        {/* Actions + expand chevron */}
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {/* Duplicate — available for own templates and public library */}
          <button
            onClick={onDuplicate}
            disabled={isDuplicating}
            title="Duplicate to my templates"
            className="py-1 px-2 rounded-lg text-xs font-mono text-slate-600 hover:text-indigo-400 transition-colors border border-transparent hover:border-indigo-500/20"
          >
            {isDuplicating ? '…' : '⎘'}
          </button>

          {isOwn && (
            <>
              <button
                onClick={onTogglePublic}
                disabled={isToggling}
                title={template.is_public ? 'Make private' : 'Share publicly'}
                className={`py-1 px-2.5 rounded-lg text-xs font-mono border transition-colors ${
                  template.is_public
                    ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20'
                    : 'border-surface-border text-slate-600 hover:text-indigo-400 hover:border-indigo-500/30'
                }`}
              >
                {isToggling ? '…' : template.is_public ? '⊡ Private' : '⊞ Share'}
              </button>

              {isConfirm ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="py-1 px-2.5 rounded-lg text-xs font-mono bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    {isDeleting ? '…' : 'Delete?'}
                  </button>
                  <button
                    onClick={onCancelDelete}
                    className="py-1 px-1.5 rounded-lg text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={onDelete}
                  className="py-1 px-2 rounded-lg text-xs font-mono text-slate-700 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20"
                >
                  ✕
                </button>
              )}
            </>
          )}
          <span className="text-slate-600 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded exercise list */}
      {expanded && (
        <div className="border-t border-surface-border">
          {sortedItems.length === 0 ? (
            <p className="px-4 py-3 text-xs font-mono text-slate-600">No exercises in this template.</p>
          ) : (
            <div className="divide-y divide-surface-border/50">
              {sortedItems.map((item, idx) => {
                const ex      = item.exercise;
                const exCfg   = ex ? CATEGORY_CONFIG[ex.category] : cfg;
                const summary = formatMetricsSummary(
                  item.prescribed_metrics as Record<string, unknown>,
                  (ex?.category ?? template.category) as SessionCategory,
                );
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-2xs font-mono text-slate-700 w-4 text-right flex-shrink-0">{idx + 1}</span>
                    <span className={`text-sm flex-shrink-0 ${exCfg.color}`}>{exCfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-300">{ex?.name ?? 'Unknown exercise'}</p>
                      {summary !== '—' && (
                        <p className="text-2xs font-mono text-slate-600">{summary}</p>
                      )}
                      {item.custom_coaching_cues && (
                        <p className="text-2xs font-mono text-slate-600 italic truncate">{item.custom_coaching_cues}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
