'use client';
import { GLOSSARY } from '@/components/views/LearnView';

/** Medical/technical term with a plain-language tooltip from the shared glossary (hover or keyboard focus). */
export function Term({ k, children }: { k: keyof typeof GLOSSARY | string; children?: React.ReactNode }) {
  const text = GLOSSARY[k as string];
  if (!text) return <>{children ?? k}</>;
  return (
    <span className="group relative inline-block">
      <span tabIndex={0} className="term" aria-describedby={undefined}>{children ?? k}</span>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-raised px-3 py-2 text-left text-xs font-normal normal-case leading-snug tracking-normal text-slate-200 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <b className="text-ink">{k}</b> — {text}
      </span>
    </span>
  );
}
