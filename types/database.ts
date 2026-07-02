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
  avatar_url:  string | null;  // personal profile photo — shown in nav
  logo_url:    string | null;  // business brand mark — shown on public templates
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
  is_shared:          boolean;
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
  client_notes?:  string | null;
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

  // Client goal
  goal_text:              string | null;
  goal_target_date:       string | null;
  goal_progress:          number | null;

  // Stripe (future)
  stripe_customer_id:     string | null;
  stripe_subscription_id: string | null;

  // Deferred deletion scheduling
  deletion_scheduled_at:  string | null;
  deletion_reason:        string | null;

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
  next_session_date:   string | null;
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

// ─── Invoices (Stripe) ────────────────────────────────────

export type InvoiceStatus = 'pending' | 'paid' | 'failed';

export interface Invoice {
  id:                       string;
  agreement_id:             string;
  stripe_invoice_id:        string | null;
  stripe_payment_intent_id: string | null;
  amount_pence:             number;
  currency:                 string;
  status:                   InvoiceStatus;
  paid_at:                  string | null;
  created_at:               string;
  // Joined
  agreement?: ClientAgreement & { client?: Profile };
}

// ─── Session Templates ─────────────────────────────────────

export interface SessionTemplate {
  id:         string;
  pt_id:      string;
  pt_name:    string | null;  // denormalized at save time for public display
  title:      string;
  category:   SessionCategory;
  notes:      string | null;
  is_public:  boolean;
  created_at: string;
  updated_at: string;
  // Joined
  pt?:             { logo_url: string | null } | null;
  template_items?: SessionTemplateItem[];
}

// ─── Bug / Feature Reports ────────────────────────────────

export type BugReportType   = 'bug' | 'feature';
export type BugReportStatus = 'open' | 'resolved';

export interface BugReport {
  id:             string;
  ref:            number;
  user_id:        string;
  url:            string;
  page_title:     string;
  notes:          string | null;
  screenshot_url: string | null;
  user_agent:     string | null;
  report_type:    BugReportType;
  status:         BugReportStatus;
  resolved_note:  string | null;
  resolved_at:    string | null;
  created_at:     string;
  // Joined
  user?: { full_name: string | null; email: string };
}

export function bugRefLabel(r: Pick<BugReport, 'ref' | 'report_type'>): string {
  return r.report_type === 'bug' ? `BUG-${r.ref}` : `REQ-${r.ref}`;
}

// ─── Wellbeing Check-ins ──────────────────────────────────

export interface WellbeingCheckin {
  id:         string;
  client_id:  string;
  session_id: string | null;
  sleep:      number;   // 1–5
  stress:     number;   // 1–5
  soreness:   number;   // 1–5
  notes:      string | null;
  created_at: string;
}

// ─── Progress Photos ──────────────────────────────────────

export interface ProgressPhoto {
  id:           string;
  client_id:    string;
  storage_path: string;
  public_url:   string;
  notes:        string | null;
  taken_at:     string;   // date YYYY-MM-DD
  created_at:   string;
}

// ─── Programme Builder ─────────────────────────────────────

export interface Programme {
  id:          string;
  pt_id:       string;
  title:       string;
  description: string | null;
  category:    SessionCategory | null;
  total_weeks: number;
  is_public:   boolean;
  created_at:  string;
  updated_at:  string;
  // Joined
  weeks?: ProgrammeWeek[];
  pt?:   { full_name: string | null; logo_url: string | null } | null;
}

export interface ProgrammeWeek {
  id:           string;
  programme_id: string;
  week_number:  number;
  label:        string | null;
  // Joined
  sessions?: ProgrammeSession[];
}

export interface ProgrammeSession {
  id:          string;
  week_id:     string;
  day_of_week: number;   // 1=Mon … 7=Sun
  title:       string;
  category:    SessionCategory;
  notes:       string | null;
  sort_order:  number;
  template_id: string | null;
  // Joined
  items?: ProgrammeSessionItem[];
}

export interface ProgrammeSessionItem {
  id:                   string;
  programme_session_id: string;
  exercise_id:          string;
  sort_order:           number;
  prescribed_metrics:   PrescribedMetrics;
  custom_coaching_cues: string | null;
  custom_youtube_url:   string | null;
  // Joined
  exercise?: Exercise;
}

export interface SessionTemplateItem {
  id:                   string;
  template_id:          string;
  exercise_id:          string;
  sort_order:           number;
  prescribed_metrics:   PrescribedMetrics;
  custom_coaching_cues: string | null;
  custom_youtube_url:   string | null;
  created_at:           string;
  // Joined
  exercise?: Exercise;
}
