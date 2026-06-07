import type { Metadata } from 'next';
import { LegalLayout }  from '@/components/LegalLayout';

export const metadata: Metadata = {
  title: 'Terms of Service - brigid.pro',
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="7 June 2026">

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">1. Acceptance of terms</h2>
        <p>
          By accessing or using Brigid.pro (the &#8220;Service&#8221;), operated by Triple Aspect
          (&#8220;we&#8221;, &#8220;us&#8221;), you agree to be bound by these Terms of Service.
          If you do not agree, do not use the Service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">2. Description of service</h2>
        <p>
          Brigid.pro is a coaching management platform that enables personal trainers and coaches
          (&#8220;Coaches&#8221;) to create and assign training programmes, and enables their clients
          (&#8220;Clients&#8221;) to access those programmes through a personal portal. The platform
          covers three coaching aspects: Healing (rehabilitation and movement), Forging (strength and
          conditioning), and Verse (habits and mindset).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">3. Not medical advice</h2>
        <p className="text-amber-400/90 font-medium">
          The content on Brigid.pro - including exercises, programmes, metrics, and coaching notes -
          is provided for informational and coaching purposes only. It does not constitute medical
          advice, diagnosis, or treatment.
        </p>
        <p>
          Always consult a qualified healthcare professional before beginning any new exercise
          programme, particularly if you have a pre-existing injury, medical condition, or health
          concern. You assume full responsibility for your use of any information or programme
          accessed through the Service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">4. Accounts and access</h2>
        <ul className="space-y-2 pl-4">
          {[
            'Client accounts are created by invitation from a Coach. You are responsible for maintaining the confidentiality of your login credentials.',
            'Coach accounts are subject to approval. Coaches are responsible for all activity under their account, including the programmes and content they create.',
            'You must provide accurate information when creating an account and keep it up to date.',
            'You must not share your account or allow others to access the Service on your behalf.',
          ].map(item => (
            <li key={item} className="flex gap-2">
              <span className="text-indigo-400 mt-0.5 flex-shrink-0">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">5. Coach responsibilities</h2>
        <p>Coaches using Brigid.pro agree that they:</p>
        <ul className="space-y-2 pl-4">
          {[
            'Hold any qualifications, certifications, or insurance required by their local jurisdiction to provide coaching services.',
            'Are solely responsible for the programmes, instructions, and advice they provide to their clients.',
            'Will not use the platform to provide services that require a medical licence or equivalent professional qualification they do not hold.',
            'Will obtain appropriate consent (PAR-Q, waiver, etc.) from clients before commencing coaching.',
          ].map(item => (
            <li key={item} className="flex gap-2">
              <span className="text-indigo-400 mt-0.5 flex-shrink-0">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul className="space-y-2 pl-4">
          {[
            'Use the Service for any unlawful purpose or in violation of any applicable law.',
            'Upload content that is harmful, abusive, obscene, or infringes any third-party rights.',
            'Attempt to gain unauthorised access to any part of the platform or another user\'s account.',
            'Reverse-engineer, scrape, or interfere with the operation of the Service.',
            'Misrepresent your identity or qualifications.',
          ].map(item => (
            <li key={item} className="flex gap-2">
              <span className="text-indigo-400 mt-0.5 flex-shrink-0">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">7. Billing and payments</h2>
        <p>
          Coaching fees are agreed between Coach and Client directly. Brigid.pro may record billing
          notes and payment information as provided by the Coach, but we are not a party to the
          financial agreement between Coach and Client. We do not currently process payments on
          behalf of Coaches; any such integration, if added in future, will be governed by
          supplementary terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">8. Intellectual property</h2>
        <p>
          The Brigid.pro platform, including its design, code, branding, and the Triple Aspect
          methodology, is owned by Triple Aspect and protected by applicable intellectual property
          laws. You may not copy, reproduce, or distribute any part of the Service without our
          written permission.
        </p>
        <p>
          Content you upload (such as progress photos or notes) remains yours. By uploading it,
          you grant us a limited licence to store and display it to you and your Coach for the
          purpose of providing the Service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">9. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, Triple Aspect shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages arising from your
          use of - or inability to use - the Service, including any injury, loss of data, or
          financial loss.
        </p>
        <p>
          Our total liability for any claim arising from these Terms shall not exceed the amount
          you paid us (if any) in the three months preceding the claim.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">10. Termination</h2>
        <p>
          We may suspend or terminate your access to the Service at any time for conduct that we
          believe violates these Terms or is harmful to other users, us, or third parties. You may
          delete your account at any time via your account settings. Upon termination, your right to
          use the Service ceases immediately.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">11. Changes to these terms</h2>
        <p>
          We may revise these Terms from time to time. We will provide reasonable notice of material
          changes. Continued use of the Service after changes take effect constitutes your acceptance
          of the updated Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">12. Governing law</h2>
        <p>
          These Terms are governed by the laws of the jurisdiction in which Triple Aspect is
          registered. Any disputes will be subject to the exclusive jurisdiction of the courts
          of that jurisdiction.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200">13. Contact</h2>
        <p>
          Questions about these Terms should be sent to{' '}
          <a href="mailto:hello@tripleaspect.fit" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            hello@tripleaspect.fit
          </a>.
        </p>
      </section>

    </LegalLayout>
  );
}
