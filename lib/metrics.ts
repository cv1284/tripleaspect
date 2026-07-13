// ============================================================
// Brigid.pro — Session Metric Field Definitions & Validation
// Single source of truth for the per-category prescribed_metrics
// shape used by SessionBuilder (UI rendering + payload building).
// ============================================================

import { PrescribedMetrics, SessionCategory } from '@/types/database';
import { stripHtmlTags } from './utils';

export type FieldDef = {
  key:          string;
  label:        string;
  type:         'number' | 'text' | 'select';
  options?:     string[];
  placeholder?: string;
  unit?:        string;
  min?:         number;
  max?:         number;
  maxLength?:   number;
};

export const METRIC_FIELDS: Record<SessionCategory, FieldDef[]> = {
  forging: [
    { key: 'sets',         label: 'Sets',     type: 'number', placeholder: '4',      unit: 'sets', min: 1, max: 50   },
    { key: 'reps',         label: 'Reps',     type: 'text',   placeholder: '8–12',   maxLength: 50 },
    { key: 'weight_kg',    label: 'Weight',   type: 'number', placeholder: '80',     unit: 'kg',   min: 0, max: 1000 },
    { key: 'rest_seconds', label: 'Rest',     type: 'number', placeholder: '90',     unit: 's',    min: 0, max: 3600 },
    { key: 'tempo',        label: 'Tempo',    type: 'text',   placeholder: '3-1-1-0', maxLength: 20 },
    { key: 'rpe',          label: 'RPE',      type: 'number', placeholder: '7',      min: 1, max: 10 },
    { key: 'notes',        label: 'Notes',    type: 'text',   placeholder: 'Optional coaching note...', maxLength: 500 },
  ],
  healing: [
    { key: 'sets',               label: 'Sets',        type: 'number', placeholder: '3',  unit: 'sets', min: 1, max: 50   },
    { key: 'reps',                label: 'Reps',        type: 'number', placeholder: '10',              min: 1, max: 500  },
    { key: 'hold_seconds',       label: 'Hold',        type: 'number', placeholder: '30', unit: 's',    min: 0, max: 600  },
    { key: 'rest_seconds',       label: 'Rest',        type: 'number', placeholder: '45', unit: 's',    min: 0, max: 3600 },
    { key: 'side',               label: 'Side',        type: 'select',
      options: ['bilateral', 'left', 'right', 'alternating'] },
    { key: 'frequency_per_day',  label: 'Freq/Day',    type: 'number', placeholder: '2',  unit: '×/d',  min: 1, max: 20 },
    { key: 'notes',              label: 'Notes',       type: 'text',   placeholder: 'Pain limit, technique cues...', maxLength: 500 },
  ],
  verse: [
    { key: 'duration_minutes', label: 'Duration',   type: 'number', placeholder: '30',   unit: 'min', min: 0, max: 1440 },
    { key: 'distance_km',      label: 'Distance',   type: 'number', placeholder: '5',    unit: 'km',  min: 0, max: 1000 },
    { key: 'pace_per_km',      label: 'Pace',       type: 'text',   placeholder: '5:30', unit: '/km', maxLength: 20 },
    { key: 'heart_rate_zone',  label: 'HR Zone',    type: 'number', placeholder: '2',                 min: 1, max: 5   },
    { key: 'notes',            label: 'Notes',      type: 'text',   placeholder: 'Mindset cue, environment...', maxLength: 500 },
  ],
};

/**
 * Converts raw string form values into a validated, bounded, HTML-stripped
 * prescribed_metrics payload. This is the only sanitization layer for
 * session/template metrics — SessionBuilder writes directly to Supabase
 * with no API route in between (see BUG-67), so it must run here.
 */
export function buildMetricsPayload(
  raw:      Record<string, string>,
  category: SessionCategory,
): PrescribedMetrics {
  const fields = METRIC_FIELDS[category];
  const result: Record<string, unknown> = {};
  for (const f of fields) {
    const v = raw[f.key];
    if (!v) continue;

    if (f.type === 'number') {
      let n = parseFloat(v);
      if (isNaN(n)) continue;
      if (f.min !== undefined) n = Math.max(f.min, n);
      if (f.max !== undefined) n = Math.min(f.max, n);
      result[f.key] = n;
    } else if (f.type === 'select') {
      if (f.options?.includes(v)) result[f.key] = v;
    } else {
      const stripped = stripHtmlTags(v);
      if (!stripped) continue;
      result[f.key] = f.maxLength ? stripped.slice(0, f.maxLength) : stripped;
    }
  }
  return result as PrescribedMetrics;
}

// ─── Tests (run via: npx tsx lib/metrics.ts) ──────────────
if (process.env.NODE_ENV !== 'production' && typeof require !== 'undefined' && require.main === module) {
  const cases: [string, Record<string, string>, SessionCategory, Record<string, unknown>][] = [
    ['happy path',                { sets: '4', reps: '8-12', weight_kg: '80', rpe: '7' }, 'forging', { sets: 4, reps: '8-12', weight_kg: 80, rpe: 7 }],
    ['sets clamped to max',       { sets: '99999' },              'forging', { sets: 50 }],
    ['weight clamped, no negative', { weight_kg: '-50' },         'forging', { weight_kg: 0 }],
    ['rest_seconds clamped',      { rest_seconds: '999999' },     'forging', { rest_seconds: 3600 }],
    ['rpe clamped above scale',   { rpe: '15' },                  'forging', { rpe: 10 }],
    ['reps HTML stripped',        { reps: '<script>alert(2)</script>AMRAP' }, 'forging', { reps: 'alert(2)AMRAP' }],
    ['notes HTML stripped',       { notes: '<b>hi</b> there' },   'forging', { notes: 'hi there' }],
    ['notes truncated to 500',    { notes: 'x'.repeat(600) },     'forging', { notes: 'x'.repeat(500) }],
    ['invalid select rejected',   { side: 'left" onmouseover="' }, 'healing', {}],
    ['valid select kept',         { side: 'left' },               'healing', { side: 'left' }],
    ['NaN number dropped',        { sets: 'not-a-number' },       'forging', {}],
    ['heart_rate_zone clamped',   { heart_rate_zone: '99' },      'verse',   { heart_rate_zone: 5 }],
    ['empty string skipped',      { sets: '' },                   'forging', {}],
  ];

  let passed = 0;
  for (const [label, raw, category, expected] of cases) {
    const result = buildMetricsPayload(raw, category);
    const ok = JSON.stringify(result) === JSON.stringify(expected);
    console.log(`${ok ? '✓' : '✗'} ${label} → ${JSON.stringify(result)} (expected ${JSON.stringify(expected)})`);
    if (ok) passed++;
  }
  console.log(`\n${passed}/${cases.length} tests passed`);
}
