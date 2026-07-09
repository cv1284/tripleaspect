import { differenceInDays, parseISO, startOfWeek, endOfWeek, isWithinInterval, isValid } from 'date-fns';
import { NextRequest } from 'next/server';
import { AgreementStatus, ClientAgreement, SessionCategory } from '@/types/database';

// ─── Request Body Parsing ──────────────────────────────────
// `req.json()` throws a SyntaxError on malformed/empty bodies, which Next.js
// surfaces as a raw, empty-bodied 500 instead of a clean validation error.
// Routes should use this helper and return 400 "Invalid JSON body" when it
// returns null.
export async function readJsonBody<T = Record<string, unknown>>(req: NextRequest): Promise<T | null> {
  try {
    return await req.json() as T;
  } catch {
    return null;
  }
}

// ─── ID Validation ─────────────────────────────────────────
// A malformed UUID passed to `.eq('id', id)` causes Postgres to throw
// "invalid input syntax for type uuid", which several routes surfaced
// verbatim as a raw error message (with 404/500 status) instead of a
// clean validation error. Routes should check this before querying.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

// ─── Date String Validation ───────────────────────────────
// `isNaN(new Date(str).getTime())` (the pattern used elsewhere) silently
// rolls invalid calendar dates over instead of rejecting them — e.g.
// "2026-02-30" becomes March 2. Shape-only regexes (`^\d{4}-\d{2}-\d{2}$`)
// have the same gap: "2026-13-99" matches the shape but isn't a real date.
// Routes accepting a YYYY-MM-DD date from the client should validate with
// this helper instead, which also rejects nonsense-but-technically-valid
// dates (e.g. year 1900 or 9999) via a sane default bound.
const DATE_SHAPE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(
  str: unknown,
  { minYear = 2000, maxYear = 2100 }: { minYear?: number; maxYear?: number } = {},
): str is string {
  if (typeof str !== 'string' || !DATE_SHAPE_REGEX.test(str)) return false;
  if (!isValid(parseISO(str))) return false;
  const year = Number(str.slice(0, 4));
  return year >= minYear && year <= maxYear;
}

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

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return differenceInDays(new Date(), parseISO(dateStr));
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

// ─── Email Validation ─────────────────────────────────────
// Basic format check before handing the value to Supabase Auth. Rejects
// values that would otherwise reach the auth provider's API and come back
// as an opaque/non-JSON error (e.g. SQL-meta-character payloads tripping
// an upstream WAF).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email);
}

// ─── HTML Sanitization ────────────────────────────────────
// Strips all HTML/XML tags from user-supplied strings before DB storage.
// Prevents stored XSS if data is ever rendered outside React's JSX escaping
// (e.g. email templates, PDF exports, third-party integrations).
export function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

// ─── HTML Escaping ────────────────────────────────────────
// Use whenever interpolating user data into an HTML string (e.g. email templates).
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
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
