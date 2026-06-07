import type { Metadata } from 'next';
import { LegalLayout }  from '@/components/LegalLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy — brigid.pro',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="7 June 2026">

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">1. Who we are</h2>
        <p>
          Brigid.pro is a precision coaching platform operated by Triple Aspect (&#8220;we&#8221;,
          &#8220;us&#8221;, or &#8220;our&#8221;). Our platform is available at{' '}
          <span className="font-mono text-slate-300">tripleaspect.fit</span>. If you have any
          questions about this policy, contact us at{' '}
          <a href="mailto:hello@tripleaspect.fit" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            hello@tripleaspect.fit
          </a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">2. Information we collect</h2>
        <p>We collect information you provide directly and information generated through your use of the platform:</p>
        <ul className="space-y-2 pl-4">
          {[
            { label: 'Account information', desc: 'Name, email address, and password when you register.' },
            { label: 'Health and fitness data', desc: 'Session logs, exercise metrics (sets, reps, load, RPE, tempo), check-in scores, and progress notes entered by you or your coach.' },
            { label: 'Progress photos', desc: 'Images you choose to upload to track physical progress. These are stored securely and visible only to you and your coach.' },
            { label: 'Onboarding documents', desc: 'Links to externally hosted documents (PAR-Q, waiver, consent forms) and confirmation of whether you have signed them.' },
            { label: 'Billing information', desc: 'Payment notes and manually recorded billing details. We do not currently store card numbers on our servers.' },
            { label: 'Usage data', desc: 'Log data such as IP address, browser type, pages visited, and timestamps, collected automatically.' },
          ].map(({ label, desc }) => (
            <li key={label} className="flex gap-2">
              <span className="text-indigo-400 mt-0.5 flex-shrink-0">–</span>
              <span><span className="text-slate-300 font-medium">{label}:</span> {desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">3. How we use your information</h2>
        <ul className="space-y-2 pl-4">
          {[
            'To provide, operate, and maintain the coaching platform.',
            'To allow your coach to design, assign, and track your training programmes.',
            'To send transactional emails such as session reminders and account invites.',
            'To monitor inactivity and send check-in prompts as configured by your coach.',
            'To improve platform performance and diagnose technical issues.',
            'To comply with legal obligations.',
          ].map(item => (
            <li key={item} className="flex gap-2">
              <span className="text-indigo-400 mt-0.5 flex-shrink-0">–</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">4. Third-party services</h2>
        <p>We use the following third-party services to operate the platform:</p>
        <ul className="space-y-2 pl-4">
          {[
            { label: 'Supabase', desc: 'Database and authentication. Your data is stored in Supabase-hosted PostgreSQL with row-level security.' },
            { label: 'Vercel', desc: 'Hosting and edge delivery of the web application.' },
            { label: 'YouTube (Google LLC)', desc: 'Exercise demonstration videos embedded in session views. YouTube may set cookies when you play a video.' },
            { label: 'Stripe (future)', desc: 'Payment processing may be enabled in a future release. No card data is processed through us directly.' },
          ].map(({ label, desc }) => (
            <li key={label} className="flex gap-2">
              <span className="text-indigo-400 mt-0.5 flex-shrink-0">–</span>
              <span><span className="text-slate-300 font-medium">{label}:</span> {desc}</span>
            </li>
          ))}
        </ul>
        <p>
          We do not sell, rent, or trade your personal data to any third party for marketing purposes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">5. Data retention</h2>
        <p>
          We retain your data for as long as your account is active or as needed to provide services.
          If you request account deletion, we will delete your personal data within 30 days, except
          where retention is required by applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">6. Your rights</h2>
        <p>Depending on your jurisdiction, you may have the right to:</p>
        <ul className="space-y-2 pl-4">
          {[
            'Access the personal data we hold about you.',
            'Request correction of inaccurate data.',
            'Request deletion of your account and associated data.',
            'Object to or restrict certain processing.',
            'Data portability (receive a copy of your data in a machine-readable format).',
          ].map(item => (
            <li key={item} className="flex gap-2">
              <span className="text-indigo-400 mt-0.5 flex-shrink-0">–</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:hello@tripleaspect.fit" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            hello@tripleaspect.fit
          </a>
          {' '}or use the account deletion option in your account settings.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">7. Security</h2>
        <p>
          We use industry-standard security practices including encrypted connections (HTTPS),
          row-level security policies on the database, and access controls to protect your data.
          No method of transmission over the internet is 100% secure; we cannot guarantee absolute
          security but take reasonable precautions to protect your information.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">8. Children</h2>
        <p>
          Brigid.pro is not intended for use by anyone under the age of 16. We do not knowingly
          collect personal information from children under 16. If you believe we have inadvertently
          collected such information, contact us immediately.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">9. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of material
          changes by updating the &#8220;Last updated&#8221; date at the top of this page. Continued
          use of the platform after changes are posted constitutes your acceptance of the updated policy.
        </p>
      </section>

    </LegalLayout>
  );
}
