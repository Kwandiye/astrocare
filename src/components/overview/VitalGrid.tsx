'use client';
import { useMemo } from 'react';
import { HeartPulse, Gauge, Droplets, Wind, Thermometer, Droplet, ArrowUpRight, ArrowDownRight, ArrowRight, type LucideIcon } from 'lucide-react';
import { useHealthStore, type VitalKey } from '@/store/useHealthStore';
import { VITALS, readVital, type VitalReading } from '@/lib/vitals';
import { STATUS_META } from '@/lib/status';
import { slope, arrowFor } from '@/lib/trend';
import { RANGES } from '@/lib/ranges';
import { Sparkline } from '@/components/ui/StatusBadge';
import { Term } from '@/components/ui/Term';
import { fmtAgo } from '@/lib/trend';
import type { MetricId, TriageStatus, Baseline } from '@/types/health';
import type { useDashboard } from '@/hooks/useDashboard';

const ICON: Record<VitalKey, LucideIcon> = { hr: HeartPulse, bp: Gauge, spo2: Droplets, resp: Wind, temp: Thermometer, glucose: Droplet };

export function useVitals(d: ReturnType<typeof useDashboard>) {
  const ticks = useHealthStore((s) => s.ticks);
  const glucoseUnit = useHealthStore((s) => s.glucoseUnit);
  const metrics = useMemo(() => {
    const map = new Map<MetricId, { status: TriageStatus; baseline: Baseline | null; reason: string | null }>();
    for (const z of Object.values(d.result.zones)) for (const m of z.metrics) if (!map.has(m.id)) map.set(m.id, m);
    return map;
  }, [d.result]);
  const stale = d.fresh.state === 'lost';
  return VITALS.map((def) => readVital(def, { tick: d.tick, ticks, stale, log: d.log as never, metrics, glucoseUnit }));
}

function VitalCard({ r, ageSec }: { r: VitalReading; ageSec: number }) {
  const open = useHealthStore((s) => s.set);
  const m = STATUS_META[r.status];
  const alarm = r.status === 'yellow' || r.status === 'red';
  const Icon = ICON[r.def.key];
  const arrow = arrowFor(slope(r.series.slice(-15)), RANGES[r.def.rangeKey].deadBand);
  const Arrow = arrow === '↑' || arrow === '↗' ? ArrowUpRight : arrow === '↓' || arrow === '↘' ? ArrowDownRight : ArrowRight;
  const delta = r.deltaPct;
  return (
    <button onClick={() => open({ metricDetail: r.def.key })} aria-label={`${r.def.label} ${r.display} ${r.unit}, ${m.label}. Open details`}
      className="card group relative flex h-full flex-col overflow-hidden rounded-card px-3.5 py-3 text-left transition hover:border-white/20 hover:bg-[#17233A]"
      style={alarm ? { borderColor: `${m.color}66`, background: `linear-gradient(0deg, ${m.bg}, ${m.bg}), #141E2D` } : undefined}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-slate-300">
          <Icon size={15} className="shrink-0 text-muted" aria-hidden />{r.def.term ? <Term k={r.def.term}>{r.def.label}</Term> : r.def.label}
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ color: m.color, background: m.bg }}>
          <m.icon size={12} aria-hidden />{m.label}
        </span>
      </div>

      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="num text-[32px] font-bold leading-none tracking-tight" style={{ color: alarm ? m.color : '#F5F7FA', opacity: r.status === 'stale' ? 0.5 : 1 }}>{r.display}</span>
        <span className="text-xs text-muted">{r.unit}</span>
        {r.series.length > 3 && <Arrow size={16} className="ml-0.5 self-center text-muted" aria-label={`trend ${arrow}`} />}
      </div>

      <div className="mt-1.5 -mx-1">
        <Sparkline values={r.series.slice(-60)} color={alarm ? m.color : '#38BDF8'} width={260} height={26} fluid
          band={r.baseline ? [r.baseline.mean - 1.5 * r.baseline.sd, r.baseline.mean + 1.5 * r.baseline.sd] : undefined} />
      </div>

      <div className="mt-auto flex items-end justify-between gap-2 pt-1.5 text-[11px]">
        <span className="text-slate-300">
          {delta != null
            ? <><b className="num font-semibold" style={{ color: Math.abs(delta) >= 10 ? m.color === STATUS_META.green.color ? '#F5F7FA' : m.color : '#F5F7FA' }}>{delta > 0 ? '+' : ''}{delta.toFixed(0)}%</b> <span className="text-muted">vs baseline {r.baseline!.mean.toFixed(r.def.decimals)}</span></>
            : <span className="text-muted">{r.normalText}</span>}
        </span>
        <span className="shrink-0 text-muted">{Number.isFinite(ageSec) ? `${fmtAgo(Math.max(0, ageSec))} ago` : '—'}</span>
      </div>
    </button>
  );
}

export function VitalGrid({ d }: { d: ReturnType<typeof useDashboard> }) {
  const readings = useVitals(d);
  const set = useHealthStore((s) => s.set);
  const unit = useHealthStore((s) => s.glucoseUnit);
  if (!d.tick) return <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">{VITALS.map((v) => <div key={v.key} className="card h-[150px] animate-pulse rounded-card" />)}</div>;
  return (
    <section aria-label="Vital signs">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-ink">Vital signs</h2>
        <button onClick={() => set({ glucoseUnit: unit === 'mg/dL' ? 'mmol/L' : 'mg/dL' })} className="text-xs text-muted hover:text-ink">Glucose in {unit === 'mg/dL' ? 'mmol/L' : 'mg/dL'}</button>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {readings.map((r) => <VitalCard key={r.def.key} r={r} ageSec={d.fresh.ageSec} />)}
      </div>
    </section>
  );
}
