import type { Config } from 'tailwindcss';

/**
 * AstroCare palette. Tailwind's default slate scale already matches the brief (#94A3B8 secondary text);
 * surfaces and status colours are added as named tokens so components never hard-code meaning.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0B1220',    // app background
        card: '#141E2D',      // primary surface
        raised: '#1B2738',    // secondary surface / inputs / hover
        line: '#22304A',      // dividers
        ink: '#F5F7FA',       // primary text
        muted: '#94A3B8',     // secondary text
        ok: '#22C55E',
        warn: '#F59E0B',
        crit: '#EF4444',
        info: '#38BDF8',
        nodata: '#64748B',
        rad: '#A78BFA',
      },
      borderRadius: { card: '14px' },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
