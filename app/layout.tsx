import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title:       'Brigid.pro',
  description: 'Precision coaching platform — Healing · Forging · Verse',
  themeColor:  '#07070d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface-0 text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
