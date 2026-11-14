'use client';
import { useMemo } from 'react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';
import { useHealthStore } from '@/store/useHealthStore';
import { useDashboard } from '@/hooks/useDashboard';
import { CAREER_DOSE_LIMIT_MSV } from '@/data/astronauts';
import { STATUS_META } from '@/lib/status';
import type { MetricId, TriageStatus, ZoneId } from '@/types/health';
import { worst } from '@/lib/triageEngine';

const lvl = (s: TriageStatus) => (s === 'red' ? 3 : s === 'yellow' ? 2 : s === 'stale' ? 0 : 1);
const lvlStatus = (n: number): TriageStatus => (n >= 3 ? 'red' : n >= 2 ? 'yellow' : 'green');

/** HRP risks (nasa.gov/hrp/risks) with the current personal risk level. Click → highlight zones on the twin. */
export function RiskRadar() {
  const d = useDashboard();
  const set = useHealthStore((s) => s.set);
  const m = (id: MetricId): TriageStatus => Object.values(d.result.zones).flatMap((z) => z.metrics).find((x) => x.id === id)?.status ?? 'green';
  const z = (id: ZoneId) => d.zoneStatus[id];
  const env = d.env.id;
  const evaHeavy = env === 'rover' || env === 'lunar_base' || env === 'mars_base' || d.log.events.includes('eva');

  const risks = useMemo(() => {
    const dosePct = d.log.cumulativeDoseMsv / CAREER_DOSE_LIMIT_MSV;
    const list: { name: string; level: number; zones: ZoneId[]; note: string }[] = [
      { name: 'Immune changes', level: lvl(worst(m('coreTemp'), m('skinTemp'))), zones: ['skin_immune'], note: 'viral reactivation → rash, fever' },
      { name: 'Sensorimotor', level: lvl(z('inner_ear')), zones: ['inner_ear'], note: 'motion sickness, dizziness' },
      { name: 'Cardiovascular', level: lvl(z('heart')), zones: ['heart'], note: 'HR, BP, orthostatic intolerance' },
      { name: 'Decompression sickness', level: evaHeavy ? 2 : 1, zones: ['knees', 'skeleton_lower'], note: evaHeavy ? 'EVA-heavy profile' : 'low — few EVAs' },
      { name: 'Hypoxia', level: lvl(m('spo2')), zones: ['lungs', 'brain'], note: `SpO₂ ${d.log.spo2}%` },
      { name: 'Microbiome', level: 1, zones: ['stomach_gi'], note: 'monitored via GI symptoms' },
      { name: 'Nutrition', level: lvl(z('stomach_gi')), zones: ['stomach_gi'], note: `${d.log.kcalIntake} kcal, ${d.log.proteinG} g protein` },
      { name: 'EVA injury', level: evaHeavy ? 2 : 1, zones: ['muscles_arms', 'knees'], note: 'hands, shoulders, knees' },
      { name: 'Fitness (cardio & MSK)', level: lvl(worst(z('muscles_legs'), z('muscles_arms'))), zones: ['muscles_legs', 'muscles_arms', 'heart'], note: 'VO₂max ≥ 36.5 ml/min/kg' },
      { name: 'SANS', level: lvl(z('eyes')), zones: ['eyes'], note: `IOP ${d.log.iop} mmHg` },
      { name: 'Bone changes', level: lvl(worst(z('skeleton_lower'), z('spine'))), zones: ['skeleton_lower', 'spine', 'kidneys'], note: `−${d.log.bmdLossCumulativePct.toFixed(1)}% BMD est.` },
      { name: 'Behavioral health', level: lvl(worst(m('mood'), m('stressVas'))), zones: ['brain'], note: `mood ${d.log.mood}/5, stress ${d.log.stressVas}` },
      { name: 'Teamwork', level: d.log.stressVas > 45 ? 2 : 1, zones: ['brain'], note: 'crew conflict risk from stress' },
      { name: 'Sleep & schedules', level: lvl(worst(m('sleepHours'), m('sleepEfficiency'))), zones: ['brain'], note: `${d.log.sleepHours} h, ${d.log.sleepEfficiency}%` },
      { name: 'Radiation (cancer)', level: Math.max(dosePct > 0.5 ? 3 : dosePct > 0.2 ? 2 : 1, lvl(m('radiationMsvDay'))), zones: ['skin_immune', 'brain'], note: `${(dosePct * 100).toFixed(1)}% of career limit` },
    ];
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.result, d.zoneStatus, d.log, evaHeavy]);

  const pick = (zones: ZoneId[]) => set({ highlightZones: zones, view: 'dashboard', selectedZone: null });

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <section className="glass rounded-xl p-3">
        <h1 className="text-lg font-bold">Risk radar <span className="text-sm font-normal text-slate-400">NASA HRP risks · {d.astronaut.name} · Day {d.log.missionDay}</span></h1>
        <div className="h-[460px]">
          <ResponsiveContainer>
            <RadarChart data={risks} outerRadius="72%">
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 3]} tickCount={4} tick={false} axisLine={false} />
              <Radar dataKey="level" stroke="#F472B6" fill="#F472B6" fillOpacity={0.25} isAnimationActive={false} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-500">1 = nominal · 2 = elevated · 3 = critical. Personal level from today&apos;s triage and the mission environment.</p>
      </section>
      <section className="glass rounded-xl p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Click a risk to highlight related zones on the twin</h2>
        <ul className="grid gap-1.5">
          {risks.sort((a, b) => b.level - a.level).map((r) => {
            const st = lvlStatus(r.level);
            const M = STATUS_META[st];
            const I = M.icon;
            return (
              <li key={r.name}>
                <button onClick={() => pick(r.zones)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-800/70">
                  <I size={15} color={M.color} aria-label={M.label} />
                  <span className="flex-1">{r.name}</span>
                  <span className="text-xs text-slate-400">{r.note}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
