'use client';
import { useMemo } from 'react';
import { Dumbbell, ArrowRight } from 'lucide-react';
import { useHealthStore } from '@/store/useHealthStore';
import { briefing } from '@/lib/astroAI';
import { useAiCtx } from '@/hooks/useAiCtx';
import { useMission } from '@/hooks/useMission';
import { metricSeries } from '@/lib/series';
import { STATUS_META } from '@/lib/status';
import { ZONES } from '@/data/zones';
import { TrendChart } from '@/components/charts/TrendChart';
import { RoutineView } from './RoutineView';
import type { ZoneId } from '@/types/health';
import type { useDashboard } from '@/hooks/useDashboard';

const BODY: ZoneId[] = ['muscles_legs', 'muscles_arms', 'skeleton_lower', 'spine', 'skeleton_upper', 'knees'];

export function TrainingView({ d }: { d: ReturnType<typeof useDashboard> }) {
  const set = useHealthStore((s) => s.set);
  const selectZone = useHealthStore((s) => s.selectZone);
  const ctx = useAiCtx(d);
  const mission = useMission(d);
  const coach = useMemo(() => briefing('fitness', ctx), [ctx]);
  const plan = coach.find((x) => x.steps);
  const activity = useMemo(() => metricSeries(d.astronaut, mission, d.log.missionDay, 'exerciseMinutes', '30d'), [d.astronaut, mission, d.log.missionDay]);
  const scores = d.scores.filter((s) => ['recovery', 'strain', 'eva', 'bone'].includes(s.id));
  const brainPlan = d.tick?.plans?.exercise;
  const nutrition = d.tick?.plans?.nutrition;
  const trajectory = d.tick?.bodyTrajectory;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Training & recovery</h1>
        <p className="text-sm text-muted">Countermeasures against muscle and bone loss, and readiness for demanding tasks.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {scores.map((s) => {
          const m = STATUS_META[s.status];
          return (
            <section key={s.id} className="card rounded-card p-4" title={s.formula}>
              <div className="flex items-center justify-between text-sm text-slate-300">{s.label}<m.icon size={16} color={m.color} /></div>
              <div className="num mt-1 text-4xl font-bold" style={{ color: s.status === 'green' ? '#F5F7FA' : m.color }}>{s.display}</div>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{s.advice[0] ?? m.label}</p>
            </section>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="card rounded-card p-5">
          <header className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><Dumbbell size={18} className="text-info" />Today&apos;s plan</h2>
            <button onClick={() => set({ view: 'assistant', aiRole: 'fitness' })} className="flex items-center gap-1 text-sm text-info hover:underline">Ask the Fitness Coach <ArrowRight size={14} /></button>
          </header>
          {brainPlan ? (
            <div className="mt-2 rounded-xl bg-raised/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold capitalize text-ink">Brain plan: {brainPlan.status}</span>
                {brainPlan.targetMinutes != null && <span className="num text-xs text-muted">target {brainPlan.targetMinutes} min</span>}
              </div>
              {brainPlan.reason && <p className="mt-1 text-sm text-slate-300">{brainPlan.reason}</p>}
              {brainPlan.sessions && <ol className="mt-2 space-y-1 text-sm text-slate-200">
                {brainPlan.sessions.map((session, index) => <li key={index} className="flex gap-2"><span className="num text-muted">{index + 1}.</span><span>{session.type} · {session.minutes} min — {session.note}</span></li>)}
              </ol>}
            </div>
          ) : <p className="mt-2 text-sm text-slate-300">{coach[0]?.text}</p>}
          {plan && (
            <>
              <p className="mt-3 text-sm font-medium" style={{ color: plan.priority ? STATUS_META[plan.priority].color : '#F5F7FA' }}>{plan.text}</p>
              <ol className="mt-2 space-y-2">
                {plan.steps!.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl bg-raised/60 px-3 py-2.5 text-sm text-slate-200">
                    <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-xs text-muted">{i + 1}</span>{s}
                  </li>
                ))}
              </ol>
            </>
          )}
          <p className="mt-3 text-sm text-slate-300">{coach[2]?.text}</p>
        </section>

        <section className="card rounded-card p-5">
          <h2 className="text-base font-semibold text-ink">Muscles & bones</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {BODY.map((z) => {
              const st = d.zoneStatus[z];
              const m = STATUS_META[st];
              return (
                <li key={z}>
                  <button onClick={() => selectZone(z)} className="flex w-full items-center gap-2 rounded-xl bg-raised/60 px-3 py-2.5 text-left text-sm hover:bg-raised">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                    <span className="flex-1 text-slate-200">{ZONES[z].name}</span>
                    <span className="text-xs" style={{ color: m.color }}>{m.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <h3 className="mt-4 text-sm font-medium text-slate-300">Exercise minutes · last 30 days</h3>
          <div className="mt-1"><TrendChart series={activity} bars height={150} /></div>
        </section>
      </div>

      {nutrition && (
        <section className="card rounded-card p-5">
          <h2 className="text-base font-semibold text-ink">Nutrition plan · {nutrition.status}</h2>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-300">
            {nutrition.targetKcal != null && <span className="num">Target {nutrition.targetKcal} kcal</span>}
            {nutrition.hydration && <span>{nutrition.hydration}</span>}
          </div>
        </section>
      )}

      {trajectory && (
        <section className="card rounded-card p-5" aria-label="Expected body trajectory">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">Expected change by mission day {trajectory.missionDay}</h2>
            <span className="text-xs text-muted">population model · {trajectory.adherenceSource ?? 'assumed'} adherence</span>
          </div>
          <p className="mt-1 text-xs text-warn">{trajectory.disclaimer}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {trajectory.parameters.map((parameter) => <div key={parameter.code} className="rounded-xl bg-raised/60 p-3">
              <div className="text-xs text-muted">{parameter.label}</div>
              <div className="num mt-1 text-lg font-semibold text-ink">{parameter.expected.toFixed(2)} {parameter.unit}</div>
              <div className="text-xs text-slate-400">range {parameter.lower.toFixed(2)} to {parameter.upper.toFixed(2)} · {parameter.status}</div>
            </div>)}
          </div>
        </section>
      )}

      <div>
        <RoutineView />
      </div>
    </div>
  );
}
