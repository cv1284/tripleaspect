import type { Metadata } from 'next';
import { LegalLayout }  from '@/components/LegalLayout';

export const metadata: Metadata = {
  title: 'Support — brigid.pro',
};

const FAQ: { q: string; a: string }[] = [
  {
    q: 'I was invited but the link has expired. What do I do?',
    a: 'Ask your coach to resend your invite. They can do this from your profile in their dashboard — there is a "Resend invite" option on your client card.',
  },
  {
    q: 'How do I complete a session?',
    a: 'Open the session from your portal home page, review each exercise, and tap the "Mark complete" button at the bottom. Your coach will be notified.',
  },
  {
    q: 'I cannot see my session — where has it gone?',
    a: 'Sessions are shown in chronological order. Check the History tab in your portal for past sessions. If a session is missing entirely, contact your coach to confirm it was assigned to you.',
  },
  {
    q: 'How do I upload a progress photo?',
    a: 'Go to the Photos tab in your client portal and tap "Add photo". Photos are private between you and your coach.',
  },
  {
    q: 'Can I change my email address or password?',
    a: 'Go to Account in your portal and use the Update Email or Change Password options. A confirmation email will be sent to your new address.',
  },
  {
    q: 'How do I sign documents (PAR-Q, waiver, consent)?',
    a: 'Your coach will share links to the required documents. Once signed, let your coach know — they will mark them as complete on their end.',
  },
  {
    q: 'I am a coach — how do I add a new client?',
    a: 'From your dashboard, go to Clients and click "Add client". Enter their name and email address and send an invitation. They will receive an email to set up their account.',
  },
  {
    q: 'How do I create a session template?',
    a: 'Go to Templates in your coach dashboard and click "New template". Templates can be reused across multiple clients and assigned directly from the session builder.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Account → Danger Zone → Delete account. This is permanent. All your data will be removed within 30 days as per our Privacy Policy.',
  },
  {
    q: 'The app is not loading or something looks broken.',
    a: 'Try refreshing the page. If the problem persists, clear your browser cache or try a different browser. If it still fails, contact us with a description of what you were doing and what you saw.',
  },
];

export default function SupportPage() {
  return (
    <LegalLayout title="Support" updated="7 June 2026">

      {/* Contact */}
      <section className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 space-y-3">
        <h2 className="text-base font-semibold text-indigo-300">Get in touch</h2>
        <p>
          For account issues, technical problems, or any question not answered below, email us at:
        </p>
        <a
          href="mailto:hello@tripleaspect.fit"
          className="inline-flex items-center gap-2 font-mono text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          hello@tripleaspect.fit →
        </a>
        <p className="text-xs font-mono text-slate-600 pt-1">
          We aim to respond within one business day.
        </p>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-slate-200">Frequently asked questions</h2>
        <div className="space-y-px rounded-2xl overflow-hidden border border-surface-border">
          {FAQ.map(({ q, a }, i) => (
            <details
              key={i}
              className="group bg-surface-2 open:bg-surface-3 transition-colors"
            >
              <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none select-none">
                <span className="text-sm font-medium text-slate-200">{q}</span>
                <span className="text-slate-600 group-open:rotate-45 transition-transform flex-shrink-0 text-lg leading-none">+</span>
              </summary>
              <p className="px-5 pb-5 text-sm text-slate-400 leading-relaxed border-t border-surface-border pt-3">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* For coaches */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">For coaches</h2>
        <p>
          If you are a coach and are interested in using Brigid.pro with your clients, reach out
          at{' '}
          <a href="mailto:hello@tripleaspect.fit" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            hello@tripleaspect.fit
          </a>
          {' '}to request access. Include a brief description of your coaching practice and how many
          clients you work with.
        </p>
      </section>

      {/* Platform info */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">Platform information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Platform', value: 'Web (mobile-optimised)' },
            { label: 'Supported browsers', value: 'Chrome, Safari, Firefox, Edge (current versions)' },
            { label: 'Contact', value: 'hello@tripleaspect.fit' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-surface-2 border border-surface-border p-4 space-y-1">
              <p className="text-xs font-mono text-slate-600 uppercase tracking-widest">{label}</p>
              <p className="text-sm text-slate-300">{value}</p>
            </div>
          ))}
        </div>
      </section>

    </LegalLayout>
  );
}
