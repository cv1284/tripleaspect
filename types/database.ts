// ============================================================
// Brigid.pro — Database Type Definitions
// ============================================================

export type UserRole        = 'pt' | 'client';
export type AgreementStatus = 'active' | 'attention' | 'paused' | 'inactive';
export type AgreementModel  = 'subscription' | 'fixed_block' | 'hybrid';
export type SessionCategory = 'healing' | 'forging' | 'verse';

// ─── Core Tables ──────────────────────────────────────────

export interface Profile {
  id:          string;
  email:       string;
  full_name:   string | null;
  role:        UserRole;
  avatar_url:  string | null;
  created_at:  string;
  updated_at:  string;
}

export interface Exercise {
  id:                 string;
  name:               string;
  description:        string | null;
  category:           SessionCategory;
  default_video_url:  string | null;  // Public CDN GIF / hosted video fallback
  custom_youtube_url: string | null;  // PT YouTube override (resolved by lib/youtube.ts)
  is_custom:          boolean;
  created_by_pt_id:   string | null;
  coaching_cues:      string | null;
  tags:               string[] | null;
  created_at:         string;
  updated_at:         string;
}

// ─── Prescribed Metric Shapes (JSONB) ─────────────────────

export interface ForgingMetrics {
  sets?:         number;
  reps?:         number | string;  // supports "8-12" rep ranges
  rest_seconds?: number;
  tempo?:        string;           // e.g. "3-1-1-0" (ecc-pause-con-top)
  weight_kg?:    number;
  rpe?:          number;           // Rate of Perceived Exertion 1–10
  notes?:        string;
}

export interface HealingMetrics {
  sets?:               number;
  reps?:               number;
  hold_seconds?:       number;
  rest_seconds?:       number;
  side?:               'bilateral' | 'left' | 'right' | 'alternating';
  frequency_per_day?:  number;
  pain_limit?:         number;     // VAS 0–10
  notes?:              string;
}

export interface VerseMetrics {
  duration_minutes?: number;
  distance_km?:      number;
  pace_per_km?:      string;       // e.g. "5:30"
  heart_rate_zone?:  1 | 2 | 3 | 4 | 5;
  intervals?:        {
    work_seconds:  number;
    rest_seconds:  number;
    rounds:        number;
  };
  notes?: string;
}

export type PrescribedMetrics =
  | ForgingMetrics
  | HealingMetrics
  | VerseMetrics
  | Record<string, unknown>;

// ─── Session & Items ──────────────────────────────────────

export interface Session {
  id:             string;
  pt_id:          string;
  client_id:      string;
  title:          string;
  category:       SessionCategory;
  scheduled_date: string | null;
  completed_at:   string | null;
  notes:          string | null;
  created_at:     string;
  updated_at:     string;
  // Joined relations
  session_items?: SessionItem[];
  client?:        Profile;
}

export interface SessionItem {
  id:                   string;
  session_id:           string;
  exercise_id:          string;
  sort_order:           number;
  prescribed_metrics:   PrescribedMetrics;
  custom_coaching_cues: string | null;
  custom_youtube_url:   string | null;  // Highest-priority YouTube source
  created_at:           string;
  // Joined
  exercise?: Exercise;
}

// ─── Client Agreement ─────────────────────────────────────

export interface ClientAgreement {
  id:                     string;
  client_id:              string;
  pt_id:                  string;

  // Lifecycle
  status:                 AgreementStatus;
  agreement_model:        AgreementModel;
  start_date:             string;
  renewal_date:           string | null;
  program_length_weeks:   number | null;

  // Onboarding docs (external cloud storage URLs)
  parq_signed:            boolean;
  parq_storage_url:       string | null;
  waiver_signed:          boolean;
  waiver_storage_url:     string | null;
  consent_signed:         boolean;
  consent_storage_url:    string | null;

  // Manual billing
  manual_price_numeric:   number | null;
  manual_currency:        string;
  billing_notes:          string | null;

  // Stripe (future)
  stripe_customer_id:     string | null;
  stripe_subscription_id: string | null;

  created_at: string;
  updated_at: string;

  // Joined relations
  client?: Profile;
  pt?:     Profile;
}

// ─── Derived / Composite ──────────────────────────────────

export interface ClientRow extends Profile {
  agreement:           ClientAgreement;
  sessions_this_week:  number;
  days_until_renewal:  number | null;
  onboarding_complete: boolean;
}

// Onboarding doc type union
export type OnboardingDocKey = 'parq' | 'waiver' | 'consent';

export interface OnboardingDoc {
  key:        OnboardingDocKey;
  label:      string;
  signed:     boolean;
  storageUrl: string | null;
}

export function getOnboardingDocs(agreement: ClientAgreement): OnboardingDoc[] {
  return [
    { key: 'parq',    label: 'PAR-Q',               signed: agreement.parq_signed,    storageUrl: agreement.parq_storage_url    },
    { key: 'waiver',  label: 'Liability Waiver',     signed: agreement.waiver_signed,  storageUrl: agreement.waiver_storage_url  },
    { key: 'consent', label: 'Informed Consent',     signed: agreement.consent_signed, storageUrl: agreement.consent_storage_url },
  ];
}

export function isOnboardingComplete(agreement: ClientAgreement): boolean {
  return agreement.parq_signed && agreement.waiver_signed && agreement.consent_signed;
}
