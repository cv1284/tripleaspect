import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // ─── Brand Palette ───────────────────────────────────
      colors: {
        surface: {
          0:  '#07070d',   // deepest bg
          1:  '#0d0d16',   // base bg
          2:  '#12121f',   // elevated surface
          3:  '#1a1a2e',   // card / panel
          4:  '#222236',   // hover / active
          border: '#2a2a45',
        },
        healing: {
          DEFAULT: '#10b981',  // emerald-500
          dim:     '#065f46',
          muted:   'rgba(16,185,129,0.12)',
        },
        forging: {
          DEFAULT: '#f59e0b',  // amber-500
          dim:     '#78350f',
          muted:   'rgba(245,158,11,0.12)',
        },
        verse: {
          DEFAULT: '#6366f1',  // indigo-500
          dim:     '#312e81',
          muted:   'rgba(99,102,241,0.12)',
        },
        critical: '#ef4444',
        warning:  '#f59e0b',
      },

      // ─── Typography ──────────────────────────────────────
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },

      // ─── Animation ───────────────────────────────────────
      keyframes: {
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        'slide-out-right': {
          '0%':   { transform: 'translateX(0)',    opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
      animation: {
        'slide-in-right':  'slide-in-right 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-out-right': 'slide-out-right 0.22s ease-in',
        'fade-in':         'fade-in 0.2s ease-out',
        'scale-in':        'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse':           'pulse 2s ease-in-out infinite',
      },

      // ─── Box Shadow ──────────────────────────────────────
      boxShadow: {
        'surface':  '0 0 0 1px rgba(42,42,69,0.8), 0 4px 24px rgba(0,0,0,0.4)',
        'glow-healing': '0 0 20px rgba(16,185,129,0.15)',
        'glow-forging': '0 0 20px rgba(245,158,11,0.15)',
        'glow-verse':   '0 0 20px rgba(99,102,241,0.15)',
      },
    },
  },
  plugins: [],
};

export default config;
