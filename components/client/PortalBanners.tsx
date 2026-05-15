'use client';

import React from 'react';
import { ClientAgreement } from '@/types/database';
import { daysUntilRenewal, isExpiringSoon } from '@/lib/utils';

interface Props {
  agreement: ClientAgreement;
  ptEmail?:  string;
}

type BannerVariant = 'critical' | 'warning' | 'info';

interface Banner {
  id:      string;
  variant: BannerVariant;
  icon:    string;
  title:   string;
  body:    string;
  cta?:    { label: string; href?: string };
}

const VARIANT_STYLES: Record<BannerVariant, { bg: string; border: string; title: string; body: string; icon: string; cta: string }> = {
  critical: {
    bg:     'bg-red-500/10',
    border: 'border-red-500/30',
    title:  'text-red-300',
    body:   'text-red-400/80',
    icon:   'text-red-400',
    cta:    'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30',
  },
  warning: {
    bg:     'bg-amber-500/10',
    border: 'border-amber-500/30',
    title:  'text-amber-300',
    body:   'text-amber-400/80',
    icon:   'text-amber-400',
    cta:    'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30',
  },
  info: {
    bg:     'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    title:  'text-indigo-300',
    body:   'text-indigo-400/80',
    icon:   'text-indigo-400',
    cta:    'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30',
  },
};

function buildBanners(agreement: ClientAgreement, ptEmail?: string): Banner[] {
  const banners: Banner[] = [];
  const contactCta = ptEmail
    ? { label: 'Contact Coach', href: `mailto:${ptEmail}` }
    : { label: 'Contact Coach' };

  // ── Onboarding document warnings ───────────────────────
  const missingDocs: string[] = [];
  if (!agreement.parq_signed)    missingDocs.push('PAR-Q');
  if (!agreement.waiver_signed)  missingDocs.push('Liability Waiver');
  if (!agreement.consent_signed) missingDocs.push('Informed Consent');

  if (missingDocs.length > 0) {
    banners.push({
      id:      'onboarding',
      variant: 'critical',
      icon:    '⚠',
      title:   'Action Required: Onboarding Incomplete',
      body:    `The following documents require your signature before training can begin: ${missingDocs.join(', ')}. Contact your coach to receive the documents.`,
      cta:     contactCta,
    });
  }

  // ── Block expiry warning ────────────────────────────────
  if (
    agreement.agreement_model !== 'subscription' &&
    agreement.renewal_date &&
    isExpiringSoon(agreement.renewal_date)
  ) {
    const days = daysUntilRenewal(agreement.renewal_date)!;
    banners.push({
      id:      'block-expiry',
      variant: 'warning',
      icon:    '⏱',
      title:   `Block Expiring${days === 0 ? ' Today' : ` in ${days} Day${days !== 1 ? 's' : ''}`}`,
      body:    'Your current fixed programme block is ending soon. Reach out to your coach to secure your next block and maintain training continuity.',
      cta:     { ...contactCta, label: 'Speak to Coach' },
    });
  }

  // ── Paused account notice ──────────────────────────────
  if (agreement.status === 'paused') {
    banners.push({
      id:      'paused',
      variant: 'info',
      icon:    '⏸',
      title:   'Training Paused',
      body:    'Your programme is currently on hold. Contact your coach when you are ready to resume.',
      cta:     { ...contactCta, label: 'Contact Coach' },
    });
  }

  // ── Attention flag ─────────────────────────────────────
  if (agreement.status === 'attention') {
    banners.push({
      id:      'attention',
      variant: 'warning',
      icon:    '◉',
      title:   'Your Coach Needs to Speak With You',
      body:    'Your coach has flagged your account. Please get in touch at your earliest convenience.',
      cta:     contactCta,
    });
  }

  return banners;
}

// ─── Banner Component ─────────────────────────────────────

function BannerCard({ banner }: { banner: Banner }) {
  const style = VARIANT_STYLES[banner.variant];
  const ctaClass = `inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${style.cta}`;

  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${style.bg} ${style.border} animate-fade-in`}>
      <span className={`text-xl flex-shrink-0 leading-none mt-0.5 ${style.icon}`}>
        {banner.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm ${style.title}`}>{banner.title}</p>
        <p className={`text-xs mt-0.5 leading-relaxed ${style.body}`}>{banner.body}</p>
        {banner.cta && (
          banner.cta.href
            ? <a href={banner.cta.href} className={ctaClass}>{banner.cta.label} →</a>
            : <button className={ctaClass}>{banner.cta.label} →</button>
        )}
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────

export default function PortalBanners({ agreement, ptEmail }: Props) {
  const banners = buildBanners(agreement, ptEmail);
  if (banners.length === 0) return null;

  return (
    <div className="space-y-3 mb-5">
      {banners.map(b => <BannerCard key={b.id} banner={b} />)}
    </div>
  );
}
