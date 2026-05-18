import { differenceInDays, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { AgreementStatus, ClientAgreement, SessionCategory } from '@/types/database';

// ─── Date Utilities ───────────────────────────────────────

export function daysUntilRenewal(renewalDate: string | null): number | null {
  if (!renewalDate) return null;
  return differenceInDays(parseISO(renewalDate), new Date());
}

export function deletionDaysRemaining(scheduledAt: string | null): number | null {
  if (!scheduledAt) return null;
  return differenceInDays(parseISO(scheduledAt), new Date());
}

export function isDeletionOverdue(scheduledAt: string | null): boolean {
  const days = deletionDaysRemaining(scheduledAt);
  return days !== null && days <= 0;
}

export function isExpiringSoon(renewalDate: string | null, thresholdDays = 7): boolean {
  const days = daysUntilRenewal(renewalDate);
  return days !== null && days >= 0 && days <= thresholdDays;
}

export function isThisWeek(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date  = parseISO(dateStr);
  const now   = new Date();
  return isWithinInterval(date, {
    start: startOfWeek(now, { weekStartsOn: 1 }),
    end:   endOfWeek(now,   { weekStartsOn: 1 }),
  });
}

// ─── Status Helpers ───────────────────────────────────────

export const STATUS_CONFIG: Record<AgreementStatus, {
  label:   string;
  color:   string;   // Tailwind bg class
  text:    string;   // Tailwind text class
  dot:     string;   // Tailwind bg for dot
}> = {
  active:    { label: 'Active',    color: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  attention: { label: 'Attention', color: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400'   },
  paused:    { label: 'Paused',    color: 'bg-indigo-500/10',  text: 'text-indigo-400',  dot: 'bg-indigo-400'  },
  inactive:  { label: 'Inactive',  color: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-400'   },
};

export const CATEGORY_CONFIG: Record<SessionCategory, {
  label: string;
  color: string;
  bg:    string;
  icon:  string;
}> = {
  healing: { label: 'Healing', color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: '◈' },
  forging: { label: 'Forging', color: 'text-amber-400',   bg: 'bg-amber-500/15',   icon: '⬡' },
  verse:   { label: 'Verse',   color: 'text-indigo-400',  bg: 'bg-indigo-500/15',  icon: '◎' },
};

// ─── Agreement Helpers ────────────────────────────────────

export function getOnboardingFlags(agreement: ClientAgreement) {
  return {
    parq:    { signed: agreement.parq_signed,    url: agreement.parq_storage_url,    label: 'PAR-Q'            },
    waiver:  { signed: agreement.waiver_signed,  url: agreement.waiver_storage_url,  label: 'Liability Waiver' },
    consent: { signed: agreement.consent_signed, url: agreement.consent_storage_url, label: 'Informed Consent' },
  };
}

export function onboardingComplianceScore(agreement: ClientAgreement): number {
  const flags = [agreement.parq_signed, agreement.waiver_signed, agreement.consent_signed];
  return flags.filter(Boolean).length;
}

export function isOnboardingComplete(agreement: ClientAgreement): boolean {
  return onboardingComplianceScore(agreement) === 3;
}

// ─── Metric Formatters ────────────────────────────────────
// Convert JSONB prescribed_metrics to human-readable summary strings.

import { ForgingMetrics, HealingMetrics, VerseMetrics, SessionCategory as Cat } from '@/types/database';

export function formatMetricsSummary(metrics: Record<string, unknown>, category: Cat): string {
  if (category === 'forging') {
    const m = metrics as ForgingMetrics;
    const parts: string[] = [];
    if (m.sets && m.reps) parts.push(`${m.sets}×${m.reps}`);
    else if (m.sets)      parts.push(`${m.sets} sets`);
    if (m.weight_kg)      parts.push(`@ ${m.weight_kg}kg`);
    if (m.tempo)          parts.push(`tempo ${m.tempo}`);
    if (m.rest_seconds)   parts.push(`${m.rest_seconds}s rest`);
    if (m.rpe)            parts.push(`RPE ${m.rpe}`);
    return parts.join(' · ') || '—';
  }

  if (category === 'healing') {
    const m = metrics as HealingMetrics;
    const parts: string[] = [];
    if (m.sets && m.reps)       parts.push(`${m.sets}×${m.reps}`);
    if (m.hold_seconds)         parts.push(`hold ${m.hold_seconds}s`);
    if (m.side && m.side !== 'bilateral') parts.push(m.side);
    if (m.rest_seconds)         parts.push(`${m.rest_seconds}s rest`);
    if (m.frequency_per_day)    parts.push(`${m.frequency_per_day}×/day`);
    return parts.join(' · ') || '—';
  }

  if (category === 'verse') {
    const m = metrics as VerseMetrics;
    const parts: string[] = [];
    if (m.duration_minutes)  parts.push(`${m.duration_minutes} min`);
    if (m.distance_km)       parts.push(`${m.distance_km} km`);
    if (m.pace_per_km)       parts.push(`@ ${m.pace_per_km}/km`);
    if (m.heart_rate_zone)   parts.push(`Zone ${m.heart_rate_zone}`);
    if (m.intervals)         parts.push(`${m.intervals.rounds}× ${m.intervals.work_seconds}s on / ${m.intervals.rest_seconds}s off`);
    return parts.join(' · ') || '—';
  }

  return '—';
}

// ─── Currency Formatter ───────────────────────────────────
export function formatCurrency(amount: number | null, currency = 'GBP'): string {
  if (amount === null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

// ─── Initials Avatar ──────────────────────────────────────
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
