'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SessionCategory } from '@/types/database';
import { CATEGORY_CONFIG } from '@/lib/utils';

export default function NewProgrammePage() {
  const router = useRouter();
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState<SessionCategory | ''>('');
  const [totalWeeks,  setTotalWeeks]  = useState('4');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleCreate() {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/programmes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, description, category: category || null, total_weeks: totalWeeks }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'Failed to create programme.'); return; }
    router.push(`/pt/programmes/${data.id}`);
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">New Programme</h1>
        <p className="text-sm font-mono text-slate-500 mt-1">Set the basics — you can build the week grid after.</p>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="label block mb-1">Title</label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="input text-base font-medium"
            placeholder="e.g. 8-Week Strength Foundation"
          />
        </div>

        <div>
          <label className="label block mb-1">Description <span className="text-slate-600 normal-case font-sans font-normal text-xs">(optional)</span></label>
          <textarea
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="input resize-none"
            placeholder="Brief overview of the programme goal…"
          />
        </div>

        <div>
          <label className="label block mb-2">Primary Aspect <span className="text-slate-600 normal-case font-sans font-normal text-xs">(optional)</span></label>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setCategory('')}
              className={`py-2 rounded-lg border text-xs font-mono transition-all ${
                !category ? 'bg-surface-4 text-slate-300 border-slate-600' : 'bg-surface-2 text-slate-500 border-surface-border'
              }`}
            >
              Mixed
            </button>
            {(['healing', 'forging', 'verse'] as SessionCategory[]).map(c => {
              const cfg = CATEGORY_CONFIG[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                    category === c
                      ? `${cfg.bg} ${cfg.color} border-current/30`
                      : 'bg-surface-2 text-slate-500 border-surface-border hover:border-slate-600'
                  }`}
                >
                  <span>{cfg.icon}</span> {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label block mb-1">Number of Weeks</label>
          <input
            type="number"
            min="1"
            max="52"
            value={totalWeeks}
            onChange={e => setTotalWeeks(e.target.value)}
            className="input w-32"
          />
        </div>

        {error && <p className="text-xs font-mono text-red-400">{error}</p>}
      </div>

      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.back()} className="btn-ghost">
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={saving}
          className="btn-primary px-6"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating…
            </span>
          ) : 'Create Programme'}
        </button>
      </div>
    </div>
  );
}
