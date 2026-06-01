'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { bugRefLabel } from '@/types/database';

type ReportType = 'bug' | 'feature';

interface Props {
  userId:    string;
  userEmail: string;
}

const TYPE_CONFIG = {
  bug: {
    icon:        '🐛',
    label:       'Bug report',
    placeholder: 'What went wrong? What did you expect to happen?',
    accent:      'text-orange-400',
    bg:          'bg-orange-500/10',
    border:      'border-orange-500/30',
    activeBg:    'bg-orange-500/15',
  },
  feature: {
    icon:        '💡',
    label:       'Feature request',
    placeholder: 'What would you like to be able to do?',
    accent:      'text-violet-400',
    bg:          'bg-violet-500/10',
    border:      'border-violet-500/30',
    activeBg:    'bg-violet-500/15',
  },
} as const;

// Compress an image file to a JPEG base64 string (max 1200px, 0.75 quality)
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width);  width = MAX; }
        else                { width  = Math.round((width  * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function BugReportButton({ userId: _userId, userEmail: _userEmail }: Props) {
  const [open,        setOpen]        = useState(false);
  const [reportType,  setReportType]  = useState<ReportType>('bug');
  const [notes,       setNotes]       = useState('');
  const [screenshot,  setScreenshot]  = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [result,      setResult]      = useState<{ label: string } | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const textareaRef   = useRef<HTMLTextAreaElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const cfg = TYPE_CONFIG[reportType];

  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open]);

  // Auto-close after success
  useEffect(() => {
    if (result) {
      const t = setTimeout(() => { setOpen(false); setResult(null); reset(); }, 3500);
      return () => clearTimeout(t);
    }
  }, [result]);

  function reset() {
    setNotes('');
    setScreenshot(null);
    setError(null);
    setReportType('bug');
  }

  function handleClose() {
    setOpen(false);
    setResult(null);
    reset();
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setScreenshot(compressed);
    } catch {
      setError('Could not attach screenshot.');
    }
    e.target.value = '';
  }, []);

  async function handleSubmit() {
    if (!notes.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/bug-reports', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url:           window.location.pathname + window.location.search,
        page_title:    document.title || window.location.pathname,
        notes:         notes.trim(),
        report_type:   reportType,
        screenshot_url: screenshot,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return; }

    setResult({ label: bugRefLabel({ ref: data.ref, report_type: reportType }) });
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        title="Report a bug or request a feature"
        className="fixed bottom-20 right-4 lg:bottom-6 z-40 w-10 h-10 rounded-full bg-surface-2 border border-surface-border shadow-surface flex items-center justify-center text-lg hover:bg-surface-3 hover:border-slate-500 transition-all"
      >
        💬
      </button>

      {!open ? null : (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="fixed inset-x-4 bottom-0 sm:inset-auto sm:right-6 sm:bottom-20 lg:bottom-6 sm:w-96 z-50 bg-surface-2 border border-surface-border rounded-2xl rounded-b-none sm:rounded-2xl shadow-surface animate-scale-in overflow-hidden">

            {/* Header — type toggle */}
            <div className="flex items-center gap-1 p-3 border-b border-surface-border">
              {(['bug', 'feature'] as ReportType[]).map(t => {
                const c = TYPE_CONFIG[t];
                return (
                  <button
                    key={t}
                    onClick={() => setReportType(t)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      reportType === t
                        ? `${c.activeBg} ${c.accent} ${c.border} border`
                        : 'text-slate-500 hover:text-slate-300 hover:bg-surface-3'
                    }`}
                  >
                    <span>{c.icon}</span> {c.label}
                  </button>
                );
              })}
              <button onClick={handleClose} className="ml-1 btn-ghost px-2 text-lg leading-none flex-shrink-0">×</button>
            </div>

            <div className="p-4 space-y-3">
              {/* Page context */}
              <p className="text-2xs font-mono text-slate-600 truncate">
                📍 {typeof window !== 'undefined' ? window.location.pathname : ''}
              </p>

              {result ? (
                <div className={`py-6 text-center space-y-1 ${cfg.bg} rounded-xl border ${cfg.border}`}>
                  <p className={`text-xl font-mono font-bold ${cfg.accent}`}>{result.label}</p>
                  <p className="text-xs font-mono text-slate-400">logged — thanks!</p>
                </div>
              ) : (
                <>
                  <textarea
                    ref={textareaRef}
                    rows={4}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={cfg.placeholder}
                    className="input resize-none text-sm"
                  />

                  {/* Screenshot */}
                  {screenshot ? (
                    <div className="relative inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={screenshot} alt="Screenshot" className="h-20 rounded-lg border border-surface-border object-cover" />
                      <button
                        onClick={() => setScreenshot(null)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface-4 border border-surface-border text-slate-400 hover:text-red-400 flex items-center justify-center text-xs leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-2xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      + attach screenshot
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {error && <p className="text-xs font-mono text-red-400">{error}</p>}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !notes.trim()}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 ${cfg.bg} ${cfg.accent} border ${cfg.border} hover:brightness-110`}
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        Sending…
                      </span>
                    ) : `Submit ${cfg.label}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
