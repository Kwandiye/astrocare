'use client';
import { useMemo, useState } from 'react';
import { HeartPulse, Gauge, Droplets, Thermometer, Moon, Activity, Brain, Radar, Workflow, ArrowRight, type LucideIcon } from 'lucide-react';
import { useHealthStore } from '@/store/useHealthStore';
import { metricSeries, hasIntraday, type TimeRange } from '@/lib/series';
import { STATUS_META } from '@/lib/status';
import { TrendChart, RangeTabs } from '@/components/charts/TrendChart';
import { Timeline } from '@/components/charts/Timeline';
import { ScoreRings } from '@/components/scores/ScoreRings';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Term } from '@/components/ui/Term';
import { useMission } from '@/hooks/useMission';
import type { MetricId } from '@/types/health';
import type { useDashboard } from '@/hooks/useDashboard';

const RANGES: { id: TimeRange; label: string }[] = [{ id: '24h', label: '24 hours' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }];

interface CardDef { id: string; title: string; icon: LucideIcon; variants: { label: string; metric: MetricId; second?: MetricId; bars?: boolean }[]; term?: string }
const CARDS: CardDef[] = [
  { id: 'hr', title: 'Heart rate', icon: HeartPulse, variants: [{ label: 'Resting HR', metric: 'hr' }, { label: 'HRV', metric: 'hrvRmssd' }] },
  { id: 'bp', title: 'Blood pressure', icon: Gauge, variants: [{ label: 'Systolic / diastolic', metric: 'sbp', second: 'dbp' }] },
  { id: 'spo2', title: 'Blood oxygen', icon: Droplets, term: 'SpO₂', variants: [{ label: 'SpO₂', metric: 'spo2' }] },
  { id: 'temp', title: 'Body temperature', icon: Thermometer, variants: [{ label: 'Core', metric: 'coreTemp' }, { label: 'Skin', metric: 'skinTemp' }] },
  { id: 'sleep', title: 'Sleep', icon: Moon, variants: [{ label: 'Duration', metric: 'sleepHours', bars: true }, { label: 'Quality', metric: 'sleepEfficiency' }] },
  { id: 'activity', title: 'Physical activity', icon: Activity, variants: [{ label: 'Total exercise', metric: 'exerciseMinutes', bars: true }, { label: 'Resistance', metric: 'resistanceMinutes', bars: true }] },
  { id: 'mind', title: 'Stress & mood', icon: Brain, variants: [{ label: 'Stress', metric: 'stressVas' }, { label: 'Mood', metric: 'mood' }] },
];

function ChartCard({ c, range, d, mission }: { c: CardDef; range: TimeRange; d: ReturnType<typeof useDashboard>; mission: ReturnType<typeof useMission> }) {
  const [vi, setVi] = useState(0);
  const v = c.variants[vi];
  const eff: TimeRange = range === '24h' && !hasIntraday(v.metric) ? '7d' : range;
  const day = d.log.missionDay;
  const s = useMemo(() => metricSeries(d.astronaut, mission, day, v.metric, eff), [d.astronaut, mission, day, v.metric, eff]);
  const s2 = useMemo(() => (v.second ? metricSeries(d.astronaut, mission, day, v.second, eff) : undefined), [d.astronaut, mission, day, v.second, eff]);
  const pts = s.points;
  const last = pts[pts.length - 1];
  const avg = pts.length ? pts.reduce((a, p) => a + p.v, 0) / pts.length : 0;
  const abnormal = pts.filter((p) => p.status !== 'green').length;
  const status = last?.status ?? 'stale';
  const Icon = c.icon;
  const dec = Math.abs(avg) < 20 ? 1 : 0;
  return (
    <section className="card rounded-card p-4" aria-label={c.title}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-muted" />
          <h2 className="text-base font-semibold text-ink">{c.term ? <Term k={c.term}>{c.title}</Term> : c.title}</h2>
        </div>
        {c.variants.length > 1 && <RangeTabs value={String(vi)} options={c.variants.map((x, i) => ({ id: String(i), label: x.label }))} onChange={(x) => setVi(Number(x))} />}
      </header>
      <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-1">
        <div>
          <div className="text-xs text-muted">{eff === '24h' ? 'Now' : 'Today'}</div>
          <div className="flex items-baseline gap-1">
            <span className="num text-3xl font-bold" style={{ color: status === 'green' ? '#F5F7FA' : STATUS_META[status].color }}>{last ? (s2 ? `${last.v}/${s2.points[s2.points.length - 1]?.v}` : last.v) : '—'}</span>
            <span className="text-sm text-muted">{s.unit}</span>
          </div>
        </div>
        <div><div className="text-xs text-muted">Average</div><div className="num text-lg font-semibold text-slate-200">{avg.toFixed(dec)}</div></div>
        {s.baseline && <div><div className="text-xs text-muted"><Term k="Baseline (μ ± σ)">Your baseline</Term></div><div className="num text-lg font-semibold text-slate-200">{s.baseline.mean}</div></div>}
        <div className="ml-auto">{s.synthetic ? <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] text-muted">demo profile</span> : abnormal ? <StatusBadge status="yellow" label={`${abnormal} outside range`} /> : <StatusBadge status="green" label="All in range" />}</div>
      </div>
      <div className="mt-3"><TrendChart series={s} second={s2} bars={v.bars} color="#38BDF8" height={190} /></div>
      <p className="mt-1.5 text-xs text-muted">
        {eff !== range && 'Measured once a day — showing 7 days. '}
        {s.synthetic && 'Synthetic 24-hour demo profile around today’s value. '}
        {s.baseline && 'Shaded band = your personal normal range.'}
      </p>
    </section>
  );
}

export function AnalyticsView({ d }: { d: ReturnType<typeof useDashboard> }) {
  const [range, setRange] = useState<TimeRange>('7d');
  const mission = useMission(d);
  const set = useHealthStore((s) => s.set);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Health analytics</h1>
          <p className="text-sm text-muted">{d.astronaut.name} · trends compared with the personal baseline · coloured dots mark readings outside the normal range</p>
        </div>
        <RangeTabs value={range} options={RANGES} onChange={setRange} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {CARDS.map((c) => <ChartCard key={c.id} c={c} range={range} d={d} mission={mission} />)}
        {/* patterns */}
        <section className="card rounded-card p-4">
          <header className="flex items-center gap-2"><Workflow size={18} className="text-muted" /><h2 className="text-base font-semibold text-ink">Detected patterns</h2></header>
          <p className="mt-1 text-xs text-muted">Combinations of signals that point the same way. Pattern matches guide checks — they are not diagnoses.</p>
          <ul className="mt-3 space-y-2">
            {d.result.syndromes.length === 0 && <li className="rounded-xl bg-ok/10 p-3 text-sm text-ok">No multi-signal patterns today.</li>}
            {d.result.syndromes.map((s) => (
              <li key={s.id} className="rounded-xl bg-raised/60 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">{s.name} <StatusBadge status={s.status} /></div>
                <p className="mt-0.5 text-sm text-slate-300">{s.explanation}</p>
              </li>
            ))}
          </ul>
          <button onClick={() => set({ view: 'radar' })} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-info hover:underline"><Radar size={15} />Open HRP risk radar <ArrowRight size={14} /></button>
        </section>
      </div>

      <section className="card rounded-card p-4">
        <h2 className="mb-1 text-base font-semibold text-ink">Readiness scores</h2>
        <p className="mb-2 text-xs text-muted">Click a score to see what drives it and what to do today.</p>
        <ScoreRings scores={d.scores} />
      </section>

      <div>
        <h2 className="mb-2 px-1 text-base font-semibold text-ink">Explore any metric across the mission</h2>
        <Timeline />
      </div>
    </div>
  );
}
