'use client';

import React, { useState } from 'react';
import { SessionItem, SessionCategory } from '@/types/database';
import { CATEGORY_CONFIG, formatMetricsSummary } from '@/lib/utils';
import VideoPlayer from './VideoPlayer';

interface Props {
  item:     SessionItem;
  index:    number;
  category: SessionCategory;
}

// ─── Metric Chip ──────────────────────────────────────────
function MetricChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-surface-3 border border-surface-border min-w-[52px]">
      <span className="text-xs font-mono font-semibold text-slate-200 leading-tight">
        {value}
      </span>
      <span className="text-2xs font-mono text-slate-600 mt-0.5 leading-none">{label}</span>
    </div>
  );
}

// ─── Metric Chips by Category ─────────────────────────────

function ForgingChips({ metrics }: { metrics: Record<string, unknown> }) {
  const m = metrics as Record<string, string | number | undefined>;
  return (
    <div className="flex gap-2 flex-wrap">
      {!!(m.sets && m.reps) && (
        <MetricChip label="vol" value={`${m.sets}×${m.reps}`} />
      )}
      {!!m.weight_kg && (
        <MetricChip label="kg" value={m.weight_kg as number} />
      )}
      {!!m.rest_seconds && (
        <MetricChip label="rest" value={`${m.rest_seconds}s`} />
      )}
      {!!m.tempo && (
        <MetricChip label="tempo" value={m.tempo as string} />
      )}
      {!!m.rpe && (
        <MetricChip label="RPE" value={m.rpe as number} />
      )}
    </div>
  );
}

function HealingChips({ metrics }: { metrics: Record<string, unknown> }) {
  const m = metrics as Record<string, string | number | undefined>;
  return (
    <div className="flex gap-2 flex-wrap">
      {!!(m.sets && m.reps) && (
        <MetricChip label="vol" value={`${m.sets}×${m.reps}`} />
      )}
      {!!m.hold_seconds && (
        <MetricChip label="hold" value={`${m.hold_seconds}s`} />
      )}
      {!!(m.side && m.side !== 'bilateral') && (
        <MetricChip label="side" value={m.side as string} />
      )}
      {!!m.rest_seconds && (
        <MetricChip label="rest" value={`${m.rest_seconds}s`} />
      )}
      {!!m.frequency_per_day && (
        <MetricChip label="freq" value={`${m.frequency_per_day}×/d`} />
      )}
    </div>
  );
}

function VerseChips({ metrics }: { metrics: Record<string, unknown> }) {
  const m = metrics as Record<string, string | number | undefined>;
  return (
    <div className="flex gap-2 flex-wrap">
      {!!m.duration_minutes && (
        <MetricChip label="time" value={`${m.duration_minutes}m`} />
      )}
      {!!m.distance_km && (
        <MetricChip label="dist" value={`${m.distance_km}km`} />
      )}
      {!!m.pace_per_km && (
        <MetricChip label="pace" value={`${m.pace_per_km}/km`} />
      )}
      {!!m.heart_rate_zone && (
        <MetricChip label="zone" value={`Z${m.heart_rate_zone}`} />
      )}
      {!!(metrics.intervals) && (
        <MetricChip
          label="intervals"
          value={`${(metrics.intervals as { rounds: number }).rounds}×`}
        />
      )}
    </div>
  );
}

function MetricDisplay({ metrics, category }: { metrics: Record<string, unknown>; category: SessionCategory }) {
  if (category === 'forging') return <ForgingChips metrics={metrics} />;
  if (category === 'healing') return <HealingChips metrics={metrics} />;
  if (category === 'verse')   return <VerseChips   metrics={metrics} />;
  return null;
}

// ─── Main Export ──────────────────────────────────────────

export default function ExerciseCard({ item, index, category }: Props) {
  const [expanded, setExpanded] = useState(false);

  const exercise = item.exercise!;
  const cfg      = CATEGORY_CONFIG[exercise.category];
  const metrics  = item.prescribed_metrics as Record<string, unknown>;
  const cues     = item.custom_coaching_cues ?? exercise.coaching_cues;
  const hasVideo = !!(item.custom_youtube_url || exercise.custom_youtube_url || exercise.default_video_url);

  return (
    <div className={`card overflow-hidden transition-shadow ${expanded ? 'shadow-surface' : ''}`}>
      {/* ── Header row ─────────────────────────────────── */}
      <button
        type="button"
        className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-surface-4 transition-colors"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        {/* Index badge */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-mono font-semibold text-sm ${cfg.bg} ${cfg.color}`}>
          {index + 1}
        </div>

        {/* Name + summary */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 text-base leading-tight">{exercise.name}</p>
          <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">
            {formatMetricsSummary(metrics, category)}
          </p>
        </div>

        {/* Indicators */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasVideo && (
            <span className="text-2xs font-mono text-slate-600 flex items-center gap-1">
              <span className="text-slate-500">▶</span>
            </span>
          )}
          <span className={`text-xs ${cfg.color} transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* ── Expanded content ───────────────────────────── */}
      {expanded && (
        <div className="border-t border-surface-border animate-fade-in">
          {/* Video */}
          <div className="px-4 pt-4">
            <VideoPlayer
              itemYouTubeUrl={item.custom_youtube_url}
              exerciseYouTubeUrl={exercise.custom_youtube_url}
              defaultVideoUrl={exercise.default_video_url}
              exerciseName={exercise.name}
            />
          </div>

          {/* Metrics */}
          <div className="px-4 pt-4">
            <p className="label mb-2">Prescription</p>
            <MetricDisplay metrics={metrics} category={category} />

            {/* Interval detail for Verse */}
            {category === 'verse' && !!metrics.intervals && (
              <div className="mt-3 p-3 rounded-lg bg-surface-3 border border-surface-border text-xs font-mono text-slate-400">
                {String((metrics.intervals as { rounds: number }).rounds)}× interval |{' '}
                {String((metrics.intervals as { work_seconds: number }).work_seconds)}s work /{' '}
                {String((metrics.intervals as { rest_seconds: number }).rest_seconds)}s rest
              </div>
            )}
          </div>

          {/* Coaching cues */}
          {cues && (
            <div className="px-4 pt-3">
              <p className="label mb-1.5">Coach's Cues</p>
              <div className={`p-3 rounded-lg text-sm leading-relaxed ${cfg.bg} ${cfg.color} border border-current/20`}>
                {cues}
              </div>
            </div>
          )}

          {/* Notes from metrics */}
          {!!metrics.notes && (
            <div className="px-4 pt-3">
              <p className="label mb-1.5">Notes</p>
              <p className="text-sm text-slate-400 font-mono leading-relaxed">{metrics.notes as string}</p>
            </div>
          )}

          <div className="h-4" />
        </div>
      )}
    </div>
  );
}
