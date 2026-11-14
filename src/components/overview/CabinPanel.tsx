'use client';
import { useMemo } from 'react';
import { Rocket, Wind, Gauge, Thermometer, Droplets, Radiation, ShieldAlert, type LucideIcon } from 'lucide-react';
import { useHealthStore } from '@/store/useHealthStore';
import { cabinReadings } from '@/lib/cabin';
import { STATUS_META, RAD_COLOR } from '@/lib/status';
import { CAREER_DOSE_LIMIT_MSV } from '@/data/astronauts';
import { Term } from '@/components/ui/Term';
import type { useDashboard } from '@/hooks/useDashboard';

const ICON: Record<string, LucideIcon> = { co2: Wind, o2: Wind, press: Gauge, temp: Thermometer, rh: Droplets, rad: Radiation };

/** Spacecraft environment — deliberately styled apart from the human vital signs. */
export function CabinPanel({ d }: { d: ReturnType<typeof useDashboard> }) {
  const selectZone = useHealthStore((s) => s.selectZone);
  const rate = d.tick?.rawVitals.radiation_dose_rate ?? d.log.radiationMsvDay;
  const cum = d.tick?.radiation_cumulative_msv ?? d.tick?.rawVitals.radiation_cumulative_msv ?? d.log.cumulativeDoseMsv;
  const items = useMemo(() => cabinReadings(d.log, d.env, rate), [d.log, d.env, rate]);
  const alerts = items.filter((i) => i.status === 'yellow' || i.status === 'red');
  const pctCareer = (cum / CAREER_DOSE_LIMIT_MSV) * 100;

  return (
    <section className="card rounded-card" aria-label="Spacecraft environment">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Rocket size={16} className="text-muted" aria-hidden />Spacecraft environment
          <span className="rounded-md bg-raised px-1.5 py-0.5 text-[11px] font-normal text-muted">{d.env.label}</span>
        </h2>
        <span className={`flex items-center gap-1 text-xs ${alerts.length ? 'text-warn' : 'text-ok'}`}>
          <ShieldAlert size={13} />{alerts.length ? `${alerts.length} environmental alert${alerts.length > 1 ? 's' : ''}` : 'No environmental alerts'}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-2 p-4 pt-3 sm:grid-cols-3 xl:grid-cols-6">
        {items.map((it) => {
          const Icon = ICON[it.id];
          const alarm = it.status === 'yellow' || it.status === 'red';
          const color = alarm ? STATUS_META[it.status as 'yellow'].color : it.id === 'rad' ? RAD_COLOR : '#F5F7FA';
          return (
            <div key={it.id} className="rounded-xl bg-raised/60 p-3" style={alarm ? { boxShadow: `inset 0 0 0 1px ${color}66` } : undefined}>
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="flex items-center gap-1.5"><Icon size={13} />{it.term ? <Term k={it.term}>{it.label}</Term> : it.label}</span>
                {it.demo && <span className="rounded bg-card px-1 text-[10px] uppercase tracking-wide text-slate-500" title="Not in the mission dataset — illustrative demo value, no alerts">demo</span>}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="num text-2xl font-semibold" style={{ color }}>{it.value}</span>
                <span className="text-xs text-muted">{it.unit}</span>
              </div>
              <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted" title={it.note}>{it.note}</div>
              {it.id === 'rad' && (
                <button onClick={() => selectZone('skin_immune')} className="mt-1 text-[11px] text-slate-300 hover:underline">
                  Mission dose {cum.toFixed(1)} mSv · {pctCareer.toFixed(1)}% of career limit
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
