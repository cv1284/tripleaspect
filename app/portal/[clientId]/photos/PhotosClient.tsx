'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { format, parseISO } from 'date-fns';
import { ProgressPhoto } from '@/types/database';

interface Props {
  initialPhotos: ProgressPhoto[];
}

function groupByMonth(photos: ProgressPhoto[]): Map<string, ProgressPhoto[]> {
  const map = new Map<string, ProgressPhoto[]>();
  for (const p of photos) {
    const key = format(parseISO(p.taken_at), 'MMMM yyyy');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

export default function PhotosClient({ initialPhotos }: Props) {
  const [photos,     setPhotos]     = useState<ProgressPhoto[]>(initialPhotos);
  const [uploading,  setUploading]  = useState(false);
  const [uploadErr,  setUploadErr]  = useState<string | null>(null);
  const [notes,      setNotes]      = useState('');
  const [takenAt,    setTakenAt]    = useState(new Date().toISOString().split('T')[0]);
  const [showForm,   setShowForm]   = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadErr(null);

    const form = new FormData();
    form.append('photo',    file);
    form.append('notes',    notes);
    form.append('taken_at', takenAt);

    const res  = await fetch('/api/portal/photos', { method: 'POST', body: form });
    const data = await res.json();
    setUploading(false);
    e.target.value = '';

    if (!res.ok) { setUploadErr(data.error ?? 'Upload failed'); return; }
    setPhotos(prev => [data as ProgressPhoto, ...prev]);
    setNotes('');
    setShowForm(false);
  }, [notes, takenAt]);

  async function handleDelete(id: string) {
    if (confirmDel !== id) { setConfirmDel(id); return; }
    setDeleting(id);
    setConfirmDel(null);
    const res = await fetch(`/api/portal/photos/${id}`, { method: 'DELETE' });
    setDeleting(null);
    if (res.ok) setPhotos(prev => prev.filter(p => p.id !== id));
  }

  const groups = groupByMonth(photos);

  return (
    <main className="max-w-lg mx-auto px-4 py-6 pb-28 space-y-6">

      {/* Upload form / trigger */}
      {showForm ? (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-200">New Photo</p>
            <button
              onClick={() => { setShowForm(false); setUploadErr(null); }}
              className="btn-ghost px-2 text-lg leading-none text-slate-500"
            >×</button>
          </div>

          <div>
            <label className="label block mb-1">Date</label>
            <input
              type="date"
              value={takenAt}
              onChange={e => setTakenAt(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="label block mb-1">
              Notes <span className="text-slate-600 font-sans normal-case text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Week 4 front pose"
              className="input"
            />
          </div>

          {uploadErr && <p className="text-xs font-mono text-red-400">{uploadErr}</p>}

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-primary w-full justify-center"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading…
              </span>
            ) : 'Choose Photo'}
          </button>

          <p className="text-2xs font-mono text-slate-600 text-center">
            JPEG, PNG or WebP · max 10 MB
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3.5 rounded-xl border border-dashed border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40 transition-all text-sm font-medium flex items-center justify-center gap-2"
        >
          <span className="text-base">▣</span>
          Add Progress Photo
        </button>
      )}

      {/* Empty state */}
      {photos.length === 0 && !showForm && (
        <div className="py-20 text-center space-y-3">
          <p className="text-4xl text-slate-700">▣</p>
          <h1 className="text-lg font-semibold text-slate-300">No photos yet</h1>
          <p className="text-slate-500 font-mono text-sm leading-relaxed">
            Track your physique over time by uploading<br />a photo after each check-in.
          </p>
        </div>
      )}

      {/* Photo grid — grouped by month */}
      {Array.from(groups.entries()).map(([month, monthPhotos]) => (
        <div key={month} className="space-y-3">
          <h2 className="text-xs font-mono text-slate-500 uppercase tracking-widest px-1">
            {month}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {monthPhotos.map(photo => {
              const isConfirming = confirmDel === photo.id;
              const isDeleting   = deleting   === photo.id;
              const dateLabel    = format(parseISO(photo.taken_at), 'EEE d MMM');

              return (
                <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-surface-border bg-surface-2">
                  {/* Photo — tap to open full-size */}
                  <a
                    href={photo.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square relative"
                  >
                    <Image
                      src={photo.public_url}
                      alt={photo.notes ?? dateLabel}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </a>

                  {/* Caption */}
                  <div className="px-2 py-1.5">
                    <p className="text-2xs font-mono text-slate-400">{dateLabel}</p>
                    {photo.notes && (
                      <p className="text-2xs font-mono text-slate-600 truncate">{photo.notes}</p>
                    )}
                  </div>

                  {/* Delete overlay */}
                  {isConfirming ? (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-3 z-10">
                      <p className="text-xs font-mono text-white">Delete this photo?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDel(null)}
                          className="px-3 py-1.5 rounded-lg bg-surface-4 border border-surface-border text-xs font-mono text-slate-300"
                        >Cancel</button>
                        <button
                          onClick={() => handleDelete(photo.id)}
                          disabled={isDeleting}
                          className="px-3 py-1.5 rounded-lg bg-red-500/80 text-xs font-mono text-white"
                        >
                          {isDeleting ? '…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDelete(photo.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white/70 text-xs font-mono flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                      title="Delete photo"
                    >×</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </main>
  );
}
