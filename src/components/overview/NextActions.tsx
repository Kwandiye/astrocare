'use client';
import { CheckCircle2, Circle, PhoneCall, Sparkles, Stethoscope, Dumbbell, Apple, Brain, ArrowRight } from 'lucide-react';
import { useHealthStore, type AiRole } from '@/store/useHealthStore';
import { STATUS_META } from '@/lib/status';
import { topInsights, ROLE_META } from '@/lib/astroAI';
import { useAiCtx } from '@/hooks/useAiCtx';
import type { useDashboard } from '@/hooks/useDashboard';

export const ROLE_ICON: Record<AiRole, typeof Stethoscope> = { doctor: Stethoscope, fitness: Dumbbell, nutrition: Apple, mind: Brain };

/** Recommended next actions: the onboard protocol checklist + one line from each Astro AI companion. */
export function NextActions({ d }: { d: ReturnType<typeof useDashboard> }) {
  const checks = useHealthStore((s) => s.protocolChecks);
  const toggle = useHealthStore((s) => s.toggleStep);
  const set = useHealthStore((s) => s.set);
  const ctx = useAiCtx(d);
  const tick = d.tick;
  const stale = d.fresh.state === 'lost';
  if (!tick) return <div className="card h-64 animate-pulse rounded-card" />;

  const steps = tick.steps?.length ? tick.steps : tick.doctorRecommendation.split(/(?<=[.!?])\s+/).filter(Boolean).map((text) => ({ text, durationMin: undefined, escalation: false }));
  const key = `rec:${tick.astronautId}:${tick.missionDay}:${tick.alertLevel}`;
  const st = checks[key] ?? [];
  const done = st.filter(Boolean).length;
  const color = stale ? STATUS_META.stale.color : STATUS_META[tick.alertLevel].color;
  const insights = topInsights(ctx).filter((x) => x.role !== 'doctor');

  return (
    <section className="card flex flex-col rounded-card" aria-label="Recommended next actions">
      <header className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles size={16} className="text-info" aria-hidden />Next actions</h2>
        {tick.alertLevel !== 'green' && <span className="num text-xs text-muted">{done}/{steps.length} done</span>}
      </header>

      <div className="px-4 pt-2">
        <p className="text-[15px] font-medium leading-snug text-ink" style={{ boxShadow: `inset 3px 0 0 ${color}`, paddingLeft: 10 }}>{tick.doctorRecommendation}</p>
        {tick.alertLevel !== 'green' && (
          <ol className="mt-2 space-y-0.5">
            {steps.map((s, i) => (
              <li key={i}>
                <button onClick={() => toggle(key, i, steps.length)} className="flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-raised/60">
                  {st[i] ? <CheckCircle2 size={18} className="mt-px shrink-0 text-ok" /> : <Circle size={18} className="mt-px shrink-0 text-slate-500" />}
                  <span className={st[i] ? 'text-muted line-through' : s.escalation ? 'text-warn' : 'text-slate-200'}>
                    {s.text}
                    {s.durationMin ? <span className="ml-1 text-xs text-muted">· {s.durationMin} min</span> : null}
                    {s.escalation && <PhoneCall size={13} className="ml-1 inline" aria-label="escalation" />}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-3 space-y-1 border-t border-white/[0.06] px-4 py-3">
        <div className="mb-1 text-xs font-medium text-muted">From Astro AI</div>
        {insights.map(({ role, out }) => {
          const Icon = ROLE_ICON[role];
          return (
            <button key={role} onClick={() => set({ view: 'assistant', aiRole: role })} className="flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-raised/60">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-raised" style={{ color: out.priority ? STATUS_META[out.priority].color : '#38BDF8' }}><Icon size={14} /></span>
              <span className="min-w-0 text-sm">
                <span className="text-xs text-muted">{ROLE_META[role].name}</span>
                <span className="line-clamp-2 block text-slate-200">{out.text}</span>
              </span>
            </button>
          );
        })}
        <button onClick={() => set({ view: 'assistant' })} className="mt-1 flex items-center gap-1 text-sm font-medium text-info hover:underline">Open AI Assistant <ArrowRight size={14} /></button>
      </div>
    </section>
  );
}
