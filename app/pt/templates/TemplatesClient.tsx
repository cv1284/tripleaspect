'use client';

import { useState } from 'react';
import Image from 'next/image';
import { SessionTemplate, SessionCategory } from '@/types/database';
import { CATEGORY_CONFIG, getInitials } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

interface Props {
  ptId:             string;
  initialTemplates: SessionTemplate[];
}

export default function TemplatesClient({ ptId, initialTemplates }: Props) {
  const [templates, setTemplates] = useState<SessionTemplate[]>(initialTemplates);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const myTemplates     = templates.filter(t => t.pt_id === ptId);
  const publicFromOthers = templates.filter(t => t.is_public && t.pt_id !== ptId);

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Session Templates</h1>
        <p className="text-sm font-mono text-slate-500 mt-1">
          Reusable session blueprints. Build from the session builder using "Save as Template", then load them into any new session.
        </p>
      </div>

      {/* My Templates */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">My Templates</p>
          <span className="text-xs font-mono text-slate-700">({myTemplates.length})</span>
        </div>

        {myTemplates.length === 0 && (
          <div className="py-12 text-center border border-dashed border-surface-border rounded-xl">
            <p className="text-slate-600 font-mono text-sm">No templates yet.</p>
            <p className="text-slate-700 font-mono text-xs mt-1">
              Open the session builder, add exercises, then click "Save as Template".
            </p>
          </div>
        )}

        {myTemplates.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            isOwn={true}
            togglingId={togglingId}
            deletingId={deletingId}
            confirmDelete={confirmDelete}
            onTogglePublic={() => togglePublic(t.id, t.is_public)}
            onDelete={() => deleteTemplate(t.id)}
            onCancelDelete={() => setConfirmDelete(null)}
          />
        ))}
      </section>

      {/* Public Library */}
      {publicFromOthers.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Public Library</p>
            <span className="text-xs font-mono text-slate-700">({publicFromOthers.length})</span>
          </div>
          <p className="text-xs font-mono text-slate-600">
            Templates shared by other PTs. Load them into the session builder to adapt for your clients.
          </p>
          {publicFromOthers.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              isOwn={false}
              togglingId={togglingId}
              deletingId={deletingId}
              confirmDelete={confirmDelete}
              onTogglePublic={() => {}}
              onDelete={() => {}}
              onCancelDelete={() => {}}
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
  togglingId, deletingId, confirmDelete,
  onTogglePublic, onDelete, onCancelDelete,
}: {
  template:       SessionTemplate;
  isOwn:          boolean;
  togglingId:     string | null;
  deletingId:     string | null;
  confirmDelete:  string | null;
  onTogglePublic: () => void;
  onDelete:       () => void;
  onCancelDelete: () => void;
}) {
  const cfg        = CATEGORY_CONFIG[template.category as SessionCategory];
  const count      = template.template_items?.length ?? 0;
  const isToggling = togglingId === template.id;
  const isDeleting = deletingId === template.id;
  const isConfirm  = confirmDelete === template.id;

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        {/* Category icon */}
        <span className={`text-xl leading-none mt-0.5 flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>

        {/* Content */}
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

        {/* Actions */}
        {isOwn && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Toggle public */}
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

            {/* Delete */}
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
          </div>
        )}
      </div>
    </div>
  );
}
