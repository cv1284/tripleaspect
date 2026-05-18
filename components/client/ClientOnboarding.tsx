'use client';

import { ClientAgreement, getOnboardingDocs } from '@/types/database';

interface Props {
  agreement:   ClientAgreement;
  firstName:   string;
  ptEmail?:    string;
  ptName?:     string;
}

export default function ClientOnboarding({ agreement, firstName, ptEmail, ptName }: Props) {
  const docs      = getOnboardingDocs(agreement);
  const signedCount = docs.filter(d => d.signed).length;
  const allSigned = signedCount === docs.length;

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">

      {/* Header */}
      <header className="sticky top-0 bg-surface-0/90 backdrop-blur-md border-b border-surface-border z-20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-mono font-bold text-sm">
            <span className="text-emerald-400">◈</span>
            <span className="text-amber-400"> ⬡</span>
            <span className="text-indigo-400"> ◎</span>
            <span className="text-slate-300 ml-2">brigid.pro</span>
          </span>
          <span className="text-xs font-mono text-slate-600">{firstName}</span>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8 pb-10 space-y-8">

        {/* Welcome */}
        <div className="space-y-2 pt-2">
          <p className="text-2xl font-bold text-slate-100">
            Welcome, {firstName}.
          </p>
          <p className="text-slate-400 text-sm leading-relaxed">
            {ptName ? `${ptName} has` : 'Your coach has'} set up your programme.
            Before training begins, three onboarding documents need your signature.
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">Documents signed</span>
            <span className={signedCount === 3 ? 'text-emerald-400' : 'text-amber-400'}>
              {signedCount} / 3
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${(signedCount / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Document steps */}
        <div className="space-y-3">
          {docs.map((doc, i) => (
            <div
              key={doc.key}
              className={`flex items-start gap-4 p-4 rounded-xl border ${
                doc.signed
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-surface-2 border-surface-border'
              }`}
            >
              {/* Step number / check */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-mono font-bold ${
                doc.signed
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-surface-4 text-slate-500'
              }`}>
                {doc.signed ? '✓' : i + 1}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${doc.signed ? 'text-emerald-300' : 'text-slate-200'}`}>
                  {doc.label}
                </p>

                {doc.signed ? (
                  <p className="text-xs font-mono text-emerald-500/70 mt-0.5">Signed ✓</p>
                ) : doc.storageUrl ? (
                  <div className="mt-2 space-y-2">
                    <a
                      href={doc.storageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                    >
                      View &amp; Sign Document →
                    </a>
                    <p className="text-2xs font-mono text-slate-600 leading-relaxed">
                      Once signed, paste the link to your copy on your{' '}
                      <a
                        href={`/portal/${agreement.client_id}/account`}
                        className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                      >
                        Account page
                      </a>
                      {' '}— your coach will verify it from there.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-mono text-slate-500 mt-1 leading-relaxed">
                    Your coach will send this document over. Once signed, paste the link to your copy on your{' '}
                    <a
                      href={`/portal/${agreement.client_id}/account`}
                      className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                    >
                      Account page
                    </a>
                    {' '}and your coach will mark it complete.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* What happens next */}
        {!allSigned && (
          <div className="p-4 rounded-xl bg-surface-2 border border-surface-border space-y-1">
            <p className="text-xs font-semibold text-slate-300">What happens next</p>
            <p className="text-xs font-mono text-slate-500 leading-relaxed">
              Sign each document and let your coach know. They will mark each one as complete and your training programme will become visible here.
            </p>
          </div>
        )}

        {/* Contact coach */}
        {ptEmail && (
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-xs font-mono text-slate-600">Questions about a document?</p>
            <a
              href={`mailto:${ptEmail}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-surface-border text-slate-400 hover:text-slate-200 hover:border-slate-500 text-sm font-medium transition-colors"
            >
              ✉ Message {ptName ?? 'your coach'}
            </a>
          </div>
        )}

      </main>
    </div>
  );
}
