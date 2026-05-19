'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  Exercise, SessionItem, Session, SessionCategory,
  ForgingMetrics, HealingMetrics, VerseMetrics, PrescribedMetrics,
  SessionTemplate,
} from '@/types/database';
import { CATEGORY_CONFIG, formatMetricsSummary, getInitials } from '@/lib/utils';
import { extractYouTubeVideoId } from '@/lib/youtube';
import { createClient } from '@/lib/supabase/client';

// ─── Metric field configs by category ─────────────────────

type FieldDef = {
  key:        string;
  label:      string;
  type:       'number' | 'text' | 'select';
  options?:   string[];
  placeholder?: string;
  unit?:      string;
};

const METRIC_FIELDS: Record<SessionCategory, FieldDef[]> = {
  forging: [
    { key: 'sets',         label: 'Sets',     type: 'number', placeholder: '4',      unit: 'sets' },
    { key: 'reps',         label: 'Reps',     type: 'text',   placeholder: '8–12'   },
    { key: 'weight_kg',    label: 'Weight',   type: 'number', placeholder: '80',     unit: 'kg'   },
    { key: 'rest_seconds', label: 'Rest',     type: 'number', placeholder: '90',     unit: 's'    },
    { key: 'tempo',        label: 'Tempo',    type: 'text',   placeholder: '3-1-1-0' },
    { key: 'rpe',          label: 'RPE',      type: 'number', placeholder: '7'       },
    { key: 'notes',        label: 'Notes',    type: 'text',   placeholder: 'Optional coaching note...' },
  ],
  healing: [
    { key: 'sets',               label: 'Sets',        type: 'number', placeholder: '3',         unit: 'sets' },
    { key: 'reps',               label: 'Reps',        type: 'number', placeholder: '10'         },
    { key: 'hold_seconds',       label: 'Hold',        type: 'number', placeholder: '30',        unit: 's'    },
    { key: 'rest_seconds',       label: 'Rest',        type: 'number', placeholder: '45',        unit: 's'    },
    { key: 'side',               label: 'Side',        type: 'select',
      options: ['bilateral', 'left', 'right', 'alternating'] },
    { key: 'frequency_per_day',  label: 'Freq/Day',    type: 'number', placeholder: '2',         unit: '×/d'  },
    { key: 'notes',              label: 'Notes',       type: 'text',   placeholder: 'Pain limit, technique cues...' },
  ],
  verse: [
    { key: 'duration_minutes', label: 'Duration',   type: 'number', placeholder: '30',    unit: 'min'     },
    { key: 'distance_km',      label: 'Distance',   type: 'number', placeholder: '5',     unit: 'km'      },
    { key: 'pace_per_km',      label: 'Pace',       type: 'text',   placeholder: '5:30',  unit: '/km'     },
    { key: 'heart_rate_zone',  label: 'HR Zone',    type: 'number', placeholder: '2'      },
    { key: 'notes',            label: 'Notes',      type: 'text',   placeholder: 'Mindset cue, environment...' },
  ],
};

// ─── Types ────────────────────────────────────────────────

type DraftItem = {
  id:                   string;  // temp local id
  exercise:             Exercise;
  prescribed_metrics:   Record<string, string>;  // string until save
  custom_coaching_cues: string;
  custom_youtube_url:   string;
  expanded:             boolean;
};

interface Props {
  ptId:           string;
  clientId:       string;
  exercises:      Exercise[];
  initialSession?: Session;
  onSaved:        (session: Session) => void;
  onCancel?:      () => void;
}

// ─── Exercise Picker Modal ────────────────────────────────

function ExercisePicker({
  exercises, category,
  onSelect, onClose,
}: {
  exercises:  Exercise[];
  category:   SessionCategory;
  onSelect:   (ex: Exercise) => void;
  onClose:    () => void;
}) {
  const [search,    setSearch]    = useState('');
  const [catFilter, setCatFilter] = useState<SessionCategory | 'all'>('all');
  const [creating,  setCreating]  = useState(false);
  const [newEx,     setNewEx]     = useState({ name: '', category: category as string, description: '', coaching_cues: '', tags: '' });
  const [saving,    setSaving]    = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const filtered = exercises.filter(e => {
    if (catFilter !== 'all' && e.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.tags?.some(t => t.includes(q));
    }
    return true;
  });

  async function handleCreate() {
    if (!newEx.name.trim()) { setCreateErr('Name is required.'); return; }
    setSaving(true);
    setCreateErr(null);
    const res  = await fetch('/api/exercises', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(newEx),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setCreateErr(data.error ?? 'Failed to create exercise'); return; }
    onSelect(data as Exercise);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-surface-2 border border-surface-border rounded-2xl z-50 shadow-surface animate-scale-in overflow-hidden" style={{ maxHeight: '70vh' }}>

        {/* Header */}
        <div className="p-4 border-b border-surface-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-slate-200">{creating ? 'Create Exercise' : 'Add Exercise'}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCreating(c => !c); setCreateErr(null); }}
                className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-colors ${
                  creating
                    ? 'bg-surface-4 text-slate-300 border-surface-border'
                    : 'text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10'
                }`}
              >
                {creating ? '← Back to library' : '+ Create new'}
              </button>
              <button onClick={onClose} className="btn-ghost px-2 text-lg leading-none">×</button>
            </div>
          </div>

          {/* Search / category filters — only in library mode */}
          {!creating && (
            <>
              <input
                autoFocus
                type="text"
                placeholder="Search exercises, tags..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input mb-2"
              />
              <div className="flex gap-1">
                {(['all', 'healing', 'forging', 'verse'] as const).map(c => {
                  const cfg = c === 'all' ? null : CATEGORY_CONFIG[c];
                  return (
                    <button
                      key={c}
                      onClick={() => setCatFilter(c)}
                      className={`px-2.5 py-1 rounded-full text-2xs font-mono transition-colors ${
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
            </>
          )}
        </div>

        {/* Library list */}
        {!creating && (
          <div className="overflow-y-auto" style={{ maxHeight: '50vh' }}>
            {filtered.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-slate-600 text-sm font-mono">No exercises found</p>
                <button onClick={() => setCreating(true)} className="text-indigo-400 text-xs font-mono hover:underline">
                  Create "{search}" as a new exercise →
                </button>
              </div>
            ) : (
              filtered.map(ex => {
                const cfg = CATEGORY_CONFIG[ex.category];
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => { onSelect(ex); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-4 transition-colors text-left border-b border-surface-border/50"
                  >
                    <span className={`text-base ${cfg.color}`}>{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{ex.name}</p>
                      {ex.tags && (
                        <p className="text-2xs font-mono text-slate-600 truncate">{ex.tags.join(' · ')}</p>
                      )}
                      {ex.is_custom && (
                        <span className="text-2xs font-mono text-indigo-500">custom</span>
                      )}
                    </div>
                    <span className={`text-2xs font-mono ${cfg.color} ${cfg.bg} px-2 py-0.5 rounded`}>
                      {cfg.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Create form */}
        {creating && (
          <div className="overflow-y-auto p-4 space-y-3" style={{ maxHeight: '55vh' }}>
            <div>
              <label className="label block mb-1">Name <span className="text-red-400">*</span></label>
              <input autoFocus type="text" value={newEx.name} onChange={e => setNewEx(p => ({ ...p, name: e.target.value }))} className="input" placeholder="e.g. Copenhagen Adductor" />
            </div>
            <div>
              <label className="label block mb-2">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {(['healing', 'forging', 'verse'] as SessionCategory[]).map(c => {
                  const cfg = CATEGORY_CONFIG[c];
                  return (
                    <button key={c} type="button" onClick={() => setNewEx(p => ({ ...p, category: c }))}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                        newEx.category === c ? `${cfg.bg} ${cfg.color} border-current/30` : 'bg-surface-3 text-slate-500 border-surface-border'
                      }`}>
                      <span>{cfg.icon}</span> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="label block mb-1">Description</label>
              <input type="text" value={newEx.description} onChange={e => setNewEx(p => ({ ...p, description: e.target.value }))} className="input" placeholder="Brief description" />
            </div>
            <div>
              <label className="label block mb-1">Default Coaching Cues</label>
              <textarea rows={2} value={newEx.coaching_cues} onChange={e => setNewEx(p => ({ ...p, coaching_cues: e.target.value }))} className="input resize-none" placeholder="Key technique points..." />
            </div>
            <div>
              <label className="label block mb-1">Tags <span className="text-slate-600 font-sans normal-case text-xs">(comma-separated)</span></label>
              <input type="text" value={newEx.tags} onChange={e => setNewEx(p => ({ ...p, tags: e.target.value }))} className="input" placeholder="e.g. adductor, unilateral, strength" />
            </div>
            {createErr && <p className="text-xs font-mono text-red-400">{createErr}</p>}
            <button onClick={handleCreate} disabled={saving} className="btn-primary w-full justify-center">
              {saving ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</span> : 'Create & Add to Session'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Metric Form ──────────────────────────────────────────

function MetricForm({
  category, metrics, onChange,
}: {
  category: SessionCategory;
  metrics:  Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const fields = METRIC_FIELDS[category];
  return (
    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-surface-border">
      {fields.map(f => (
        <div key={f.key} className={f.key === 'notes' ? 'col-span-2' : ''}>
          <label className="label mb-1 flex items-center justify-between">
            <span>{f.label}</span>
            {f.unit && <span className="text-slate-600 normal-case">{f.unit}</span>}
          </label>
          {f.type === 'select' ? (
            <select
              value={metrics[f.key] ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
              className="input"
            >
              <option value="">—</option>
              {f.options!.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={metrics[f.key] ?? ''}
              onChange={e => onChange(f.key, e.target.value)}
              className="input"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Template Picker Modal ────────────────────────────────

function TemplatePicker({
  onLoad, onClose,
}: {
  onLoad:  (tpl: SessionTemplate) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(data => { setTemplates(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  const filtered = templates.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()),
  );

  const privateTemplates = filtered.filter(t => !t.is_public);
  const publicTemplates  = filtered.filter(t => t.is_public);

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-lg mx-auto bg-surface-2 border border-surface-border rounded-2xl z-50 shadow-surface animate-scale-in overflow-hidden" style={{ maxHeight: '70vh' }}>

        <div className="p-4 border-b border-surface-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-200">Load from Template</h3>
            <button onClick={onClose} className="btn-ghost px-2 text-lg leading-none">×</button>
          </div>
          <input
            autoFocus
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input"
          />
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
          {loading && (
            <div className="py-10 flex justify-center">
              <span className="w-5 h-5 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="py-10 text-center text-slate-600 font-mono text-sm">
              No templates yet. Save a session as a template to see it here.
            </div>
          )}

          {!loading && privateTemplates.length > 0 && (
            <>
              <p className="px-4 py-2 text-2xs font-mono text-slate-600 uppercase tracking-widest border-b border-surface-border">
                My Templates
              </p>
              {privateTemplates.map(t => <TemplateRow key={t.id} template={t} onLoad={onLoad} onClose={onClose} />)}
            </>
          )}

          {!loading && publicTemplates.length > 0 && (
            <>
              <p className="px-4 py-2 text-2xs font-mono text-slate-600 uppercase tracking-widest border-b border-surface-border">
                Public Library
              </p>
              {publicTemplates.map(t => <TemplateRow key={t.id} template={t} onLoad={onLoad} onClose={onClose} />)}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function TemplateRow({ template, onLoad, onClose }: { template: SessionTemplate; onLoad: (t: SessionTemplate) => void; onClose: () => void }) {
  const cfg   = CATEGORY_CONFIG[template.category as SessionCategory];
  const count = template.template_items?.length ?? 0;
  return (
    <button
      type="button"
      onClick={() => { onLoad(template); onClose(); }}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-4 transition-colors text-left border-b border-surface-border/50"
    >
      <span className={`text-base flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{template.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-2xs font-mono text-slate-600">
            {count} exercise{count !== 1 ? 's' : ''}
          </p>
          {template.is_public && template.pt_name && (
            <span className="flex items-center gap-1">
              <span className="w-4 h-4 rounded-full overflow-hidden bg-surface-4 border border-surface-border flex-shrink-0 flex items-center justify-center">
                {template.pt?.logo_url ? (
                  <Image src={template.pt.avatar_url} alt={template.pt_name} width={16} height={16} className="object-cover w-full h-full" unoptimized />
                ) : (
                  <span className="text-2xs font-mono text-slate-500">{template.pt_name[0]}</span>
                )}
              </span>
              <span className="text-2xs font-mono text-indigo-400/70">{template.pt_name}</span>
            </span>
          )}
        </div>
      </div>
      <span className={`text-2xs font-mono px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
        {cfg.label}
      </span>
    </button>
  );
}

// ─── Save Template Modal ──────────────────────────────────

function SaveTemplateModal({
  defaultTitle,
  onSave,
  onClose,
}: {
  defaultTitle: string;
  onSave:       (name: string) => Promise<void>;
  onClose:      () => void;
}) {
  const [name,   setName]   = useState(defaultTitle);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);
  const [done,   setDone]   = useState(false);

  async function handleSave() {
    if (!name.trim()) { setErr('Template name is required.'); return; }
    setSaving(true);
    try {
      await onSave(name.trim());
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to save template');
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto bg-surface-2 border border-surface-border rounded-2xl z-50 shadow-surface animate-scale-in p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-200">Save as Template</h3>
          <button onClick={onClose} className="btn-ghost px-2 text-lg leading-none">×</button>
        </div>
        <p className="text-xs font-mono text-slate-500">
          Save this session's exercises as a reusable template. You can share it publicly with other PTs from the Template Library.
        </p>
        {done ? (
          <p className="text-sm font-mono text-emerald-400 text-center py-2">✓ Template saved!</p>
        ) : (
          <>
            <div>
              <label className="label block mb-1">Template Name</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="input"
                placeholder="e.g. Lower Body Strength A"
              />
            </div>
            {err && <p className="text-xs font-mono text-red-400">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-5">
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : 'Save Template'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Item Card ────────────────────────────────────────────

function ItemCard({
  item, index, total, category,
  onRemove, onMoveUp, onMoveDown,
  onChange, onToggleExpand,
}: {
  item:            DraftItem;
  index:           number;
  total:           number;
  category:        SessionCategory;
  onRemove:        () => void;
  onMoveUp:        () => void;
  onMoveDown:      () => void;
  onChange:        (patch: Partial<DraftItem>) => void;
  onToggleExpand:  () => void;
}) {
  const cfg       = CATEGORY_CONFIG[item.exercise.category];
  const ytId      = extractYouTubeVideoId(item.custom_youtube_url || item.exercise.custom_youtube_url);
  const summary   = formatMetricsSummary(
    Object.fromEntries(Object.entries(item.prescribed_metrics).filter(([, v]) => v !== '')) as Record<string, unknown>,
    category,
  );

  return (
    <div className={`card transition-all ${item.expanded ? 'ring-1 ring-indigo-500/30' : ''}`}>
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggleExpand}>
        {/* Drag handle & index */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <span className="text-slate-600 text-xs leading-none">⠿</span>
          <span className="text-2xs font-mono text-slate-600">{index + 1}</span>
        </div>

        {/* Category icon */}
        <span className={`text-lg ${cfg.color} flex-shrink-0`}>{cfg.icon}</span>

        {/* Name + summary */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200">{item.exercise.name}</p>
          <p className="text-2xs font-mono text-slate-600 truncate">{summary}</p>
        </div>

        {/* YouTube indicator */}
        {ytId && (
          <span className="text-2xs font-mono text-red-400 flex-shrink-0">▶ YT</span>
        )}

        {/* Move / remove */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onMoveUp}   disabled={index === 0}       className="btn-ghost py-1 px-1.5 disabled:opacity-20 text-xs">↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="btn-ghost py-1 px-1.5 disabled:opacity-20 text-xs">↓</button>
          <button onClick={onRemove}                                  className="btn-ghost py-1 px-1.5 text-xs text-red-500/70 hover:text-red-400">×</button>
        </div>

        <span className="text-slate-600 text-xs">{item.expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded editor */}
      {item.expanded && (
        <div className="px-4 pb-4 border-t border-surface-border space-y-3">
          {/* Metrics */}
          <MetricForm
            category={category}
            metrics={item.prescribed_metrics}
            onChange={(key, val) => onChange({
              prescribed_metrics: { ...item.prescribed_metrics, [key]: val },
            })}
          />

          {/* Custom YouTube */}
          <div>
            <label className="label block mb-1">Custom YouTube URL (overrides library default)</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://youtu.be/..."
                value={item.custom_youtube_url}
                onChange={e => onChange({ custom_youtube_url: e.target.value })}
                className={`input ${
                  item.custom_youtube_url && !extractYouTubeVideoId(item.custom_youtube_url)
                    ? 'border-red-500/50'
                    : ''
                }`}
              />
              {ytId && (
                <a
                  href={`https://youtu.be/${ytId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 btn-ghost py-1 px-2 text-xs"
                >
                  ▶
                </a>
              )}
            </div>
            {item.custom_youtube_url && !extractYouTubeVideoId(item.custom_youtube_url) && (
              <p className="text-2xs font-mono text-red-400 mt-1">Invalid YouTube URL — video ID not found.</p>
            )}
          </div>

          {/* Coaching cues */}
          <div>
            <label className="label block mb-1">Coaching Cues (per-set notes for client)</label>
            <textarea
              rows={2}
              placeholder={item.exercise.coaching_cues ?? 'Add specific coaching notes for this set...'}
              value={item.custom_coaching_cues}
              onChange={e => onChange({ custom_coaching_cues: e.target.value })}
              className="input resize-none text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────

function buildMetricsPayload(
  raw: Record<string, string>,
  category: SessionCategory,
): PrescribedMetrics {
  const fields = METRIC_FIELDS[category];
  const result: Record<string, unknown> = {};
  for (const f of fields) {
    const v = raw[f.key];
    if (!v) continue;
    if (f.type === 'number') {
      const n = parseFloat(v);
      if (!isNaN(n)) result[f.key] = n;
    } else {
      result[f.key] = v;
    }
  }
  return result as PrescribedMetrics;
}

let draftIdCounter = 0;
function newDraftId() { return `draft_${++draftIdCounter}`; }

export default function SessionBuilder({
  ptId, clientId, exercises, initialSession, onSaved, onCancel,
}: Props) {
  const [title,       setTitle]       = useState(initialSession?.title ?? '');
  const [category,    setCategory]    = useState<SessionCategory>(initialSession?.category ?? 'forging');
  const [schedDate,   setSchedDate]   = useState(initialSession?.scheduled_date ?? '');
  const [notes,       setNotes]       = useState(initialSession?.notes ?? '');
  const [items,       setItems]       = useState<DraftItem[]>([]);
  const [showPicker,        setShowPicker]        = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSaveTemplate,  setShowSaveTemplate]  = useState(false);
  const [saving,            setSaving]            = useState(false);
  const [error,             setError]             = useState<string | null>(null);

  const cfg = CATEGORY_CONFIG[category];

  // ── Hydrate exercises when editing an existing session ──
  useEffect(() => {
    const existingItems = initialSession?.session_items;
    if (!existingItems?.length) return;
    setItems(
      [...existingItems]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(item => ({
          id:                   newDraftId(),
          exercise:             item.exercise as Exercise,
          prescribed_metrics:   Object.fromEntries(
            Object.entries(item.prescribed_metrics ?? {}).map(([k, v]) => [k, String(v)])
          ),
          custom_coaching_cues: item.custom_coaching_cues ?? '',
          custom_youtube_url:   item.custom_youtube_url   ?? '',
          expanded:             false,
        }))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount only

  // ── Item helpers ────────────────────────────────────────

  const DEFAULT_METRICS: Record<SessionCategory, Record<string, string>> = {
    forging: { sets: '3', reps: '10' },
    healing: { sets: '3', hold_seconds: '30', side: 'bilateral' },
    verse:   { duration_minutes: '30' },
  };

  function addExercise(ex: Exercise) {
    setItems(prev => [...prev, {
      id:                   newDraftId(),
      exercise:             ex,
      prescribed_metrics:   { ...DEFAULT_METRICS[category] },
      custom_coaching_cues: '',
      custom_youtube_url:   '',
      expanded:             true,
    }]);
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function updateItem(id: string, patch: Partial<DraftItem>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }

  function moveItem(idx: number, dir: 1 | -1) {
    const target = idx + dir;
    setItems(prev => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function collapseAll() {
    setItems(prev => prev.map(i => ({ ...i, expanded: false })));
  }

  function handleLoadTemplate(tpl: SessionTemplate) {
    const tplItems = tpl.template_items ?? [];
    setItems(
      [...tplItems]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(item => ({
          id:                   newDraftId(),
          exercise:             item.exercise as Exercise,
          prescribed_metrics:   Object.fromEntries(
            Object.entries(item.prescribed_metrics ?? {}).map(([k, v]) => [k, String(v)]),
          ),
          custom_coaching_cues: item.custom_coaching_cues ?? '',
          custom_youtube_url:   item.custom_youtube_url   ?? '',
          expanded:             false,
        }))
    );
    if (tpl.category) setCategory(tpl.category as SessionCategory);
    if (!title.trim()) setTitle(tpl.title);
  }

  async function handleSaveAsTemplate(templateName: string) {
    const payload = {
      title:    templateName,
      category,
      notes:    notes || null,
      items: items.map((item, idx) => ({
        exercise_id:          item.exercise.id,
        sort_order:           idx,
        prescribed_metrics:   buildMetricsPayload(item.prescribed_metrics, category),
        custom_coaching_cues: item.custom_coaching_cues || null,
        custom_youtube_url:   item.custom_youtube_url   || null,
      })),
    };
    const res = await fetch('/api/templates', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Failed to save template');
    }
  }

  // ── Save ────────────────────────────────────────────────

  async function handleSave() {
    if (!title.trim()) { setError('Session title is required.'); return; }
    if (items.length === 0) { setError('Add at least one exercise.'); return; }

    setSaving(true);
    setError(null);
    const supabase = createClient();

    // Upsert session row
    const sessionPayload = {
      pt_id:          ptId,
      client_id:      clientId,
      title:          title.trim(),
      category,
      scheduled_date: schedDate || null,
      notes:          notes || null,
    };

    let sessionId = initialSession?.id;

    if (sessionId) {
      const { error: e } = await supabase
        .from('sessions')
        .update(sessionPayload)
        .eq('id', sessionId);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { data, error: e } = await supabase
        .from('sessions')
        .insert(sessionPayload)
        .select('id')
        .single();
      if (e || !data) { setError(e?.message ?? 'Failed to create session'); setSaving(false); return; }
      sessionId = data.id;
    }

    // Delete existing items if editing
    if (initialSession?.id) {
      await supabase.from('session_items').delete().eq('session_id', sessionId!);
    }

    // Insert items
    const itemPayloads = items.map((item, idx) => ({
      session_id:           sessionId!,
      exercise_id:          item.exercise.id,
      sort_order:           idx,
      prescribed_metrics:   buildMetricsPayload(item.prescribed_metrics, category),
      custom_coaching_cues: item.custom_coaching_cues || null,
      custom_youtube_url:   item.custom_youtube_url || null,
    }));

    const { error: itemErr } = await supabase.from('session_items').insert(itemPayloads);
    if (itemErr) { setError(itemErr.message); setSaving(false); return; }

    setSaving(false);

    const savedSession: Session = {
      ...(initialSession ?? {
        id:          sessionId!,
        pt_id:       ptId,
        client_id:   clientId,
        completed_at: null,
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      }),
      ...sessionPayload,
      id: sessionId!,
    };

    onSaved(savedSession);
  }

  // ─────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            {initialSession ? 'Edit Session' : 'New Session'}
          </h2>
          <p className="text-sm text-slate-500 font-mono mt-0.5">
            {items.length} exercise{items.length !== 1 ? 's' : ''} · {cfg.label}
          </p>
        </div>
        {items.length > 1 && (
          <button onClick={collapseAll} className="btn-ghost text-xs">Collapse all</button>
        )}
      </div>

      {/* Session metadata */}
      <div className="card p-5 space-y-4">
        <p className="section-header">Session Details</p>

        <div>
          <label className="label block mb-1">Title</label>
          <input
            type="text"
            placeholder="e.g. Lower Body Strength A"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="input text-base font-medium"
          />
        </div>

        {/* Category selector */}
        <div>
          <label className="label block mb-2">Category (Aspect)</label>
          <div className="grid grid-cols-3 gap-2">
            {(['healing', 'forging', 'verse'] as SessionCategory[]).map(c => {
              const c_cfg = CATEGORY_CONFIG[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    category === c
                      ? `${c_cfg.bg} ${c_cfg.color} border-current/30`
                      : 'bg-surface-2 text-slate-500 border-surface-border hover:border-slate-600'
                  }`}
                >
                  <span>{c_cfg.icon}</span> {c_cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label block mb-1">Scheduled Date</label>
            <input
              type="date"
              value={schedDate}
              onChange={e => setSchedDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label block mb-1">PT Notes (internal)</label>
            <input
              type="text"
              placeholder="Internal notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Exercise list */}
      <div className="space-y-2">
        {items.length === 0 && (
          <div className="py-12 text-center border border-dashed border-surface-border rounded-xl text-slate-600 font-mono text-sm">
            No exercises yet — add from the library below.
          </div>
        )}

        {items.map((item, idx) => (
          <ItemCard
            key={item.id}
            item={item}
            index={idx}
            total={items.length}
            category={category}
            onRemove={() => removeItem(item.id)}
            onMoveUp={() => moveItem(idx, -1)}
            onMoveDown={() => moveItem(idx, 1)}
            onChange={patch => updateItem(item.id, patch)}
            onToggleExpand={() => updateItem(item.id, { expanded: !item.expanded })}
          />
        ))}
      </div>

      {/* Add exercise / Load template buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className={`flex-1 py-3 rounded-xl border border-dashed transition-all text-sm font-medium flex items-center justify-center gap-2 ${cfg.color} border-current/20 hover:border-current/50`}
        >
          <span className="text-base">+</span>
          Add Exercise
        </button>
        <button
          type="button"
          onClick={() => setShowTemplatePicker(true)}
          className="py-3 px-5 rounded-xl border border-dashed border-indigo-500/20 text-indigo-400 hover:border-indigo-500/50 transition-all text-sm font-medium flex items-center gap-2"
        >
          ⊞ Load Template
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
          {error}
        </div>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => setShowSaveTemplate(true)}
          disabled={items.length === 0}
          className="btn-ghost text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-30"
        >
          ⊞ Save as Template
        </button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="btn-ghost">
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-6"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              initialSession ? 'Update Session' : 'Save Session'
            )}
          </button>
        </div>
      </div>

      {/* Exercise picker modal */}
      {showPicker && (
        <ExercisePicker
          exercises={exercises}
          category={category}
          onSelect={addExercise}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Template picker modal */}
      {showTemplatePicker && (
        <TemplatePicker
          onLoad={handleLoadTemplate}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}

      {/* Save as template modal */}
      {showSaveTemplate && (
        <SaveTemplateModal
          defaultTitle={title || 'My Template'}
          onSave={handleSaveAsTemplate}
          onClose={() => setShowSaveTemplate(false)}
        />
      )}
    </div>
  );
}
