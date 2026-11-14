'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, MapPin, MessageCircle } from 'lucide-react';
import { useHealthStore } from '@/store/useHealthStore';
import { vitalByKey } from '@/lib/vitals';
import { metricSeries, type TimeRange } from '@/lib/series';
import { STATUS_META } from '@/lib/status';
import { ZonePanel } from '@/components/panel/ZonePanel';
import { TrendChart, RangeTabs } from '@/components/charts/TrendChart';
import { useVitals } from './VitalGrid';
import { useMission } from '@/hooks/useMission';
import type { useDashboard } from '@/hooks/useDashboard';

const RANGES: { id: TimeRange; label: string }[] = [{ id: '24h', label: '24 hours' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }];

function Shell({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <motion.aside role="dialog" aria-label={label} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: 0.2 }}
      className="fixed bottom-0 right-0 top-14 z-40 flex w-full max-w-[520px] flex-col border-l border-white/10 bg-card shadow-2xl sm:bottom-3 sm:right-3 sm:top-[68px] sm:rounded-card sm:border">
      {children}
    </motion.aside>
  );
}

/** Details for one vital sign: value, status reason, baseline, and history with time filters. */
function MetricDrawer({ d }: { d: ReturnType<typeof useDashboard> }) {
  const key = useHealthStore((s) => s.metricDetail)!;
  const set = useHealthStore((s) => s.set);
  const selectZone = useHealthStore((s) => s.selectZone);
  const [range, setRange] = useState<TimeRange>('24h');
  const mission = useMission(d);
  const def = vitalByKey(key);
  const r = useVitals(d).find((x) => x.def.key === key)!;
  const series = useMemo(() => metricSeries(d.astronaut, mission, d.log.missionDay, def.metric, range), [d.astronaut, mission, d.log.missionDay, def.metric, range]);
  const dia = useMemo(() => (key === 'bp' ? metricSeries(d.astronaut, mission, d.log.missionDay, 'dbp', range) : undefined), [key, d.astronaut, mission, d.log.missionDay, range]);
  const m = STATUS_META[r.status];
  const close = () => set({ metricDetail: null });
  const abnormal = series.points.filter((p) => p.status !== 'green').length;

  return (
    <Shell onClose={close} label={`${def.label} details`}>
      <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] p-5">
        <div>
          <div className="text-sm text-muted">{def.label}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-5xl font-bold" style={{ color: r.status === 'green' ? '#F5F7FA' : m.color }}>{r.display}</span>
            <span className="text-muted">{r.unit}</span>
          </div>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: m.color, background: m.bg }}><m.icon size={13} />{m.label}</span>
        </div>
        <button onClick={close} className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label="Close"><X size={18} /></button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto p-5 scroll-thin">
        {r.reason && <p className="rounded-xl p-3 text-sm text-ink" style={{ background: m.bg }}>{r.reason}</p>}
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div><dt className="text-xs text-muted">Your baseline</dt><dd className="num font-semibold text-ink">{r.baseline ? `${r.baseline.mean.toFixed(def.decimals)} ${def.unit}` : '—'}</dd></div>
          <div><dt className="text-xs text-muted">Difference</dt><dd className="num font-semibold text-ink">{r.deltaPct != null ? `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct.toFixed(0)}%` : '—'}</dd></div>
          <div><dt className="text-xs text-muted">Source</dt><dd className="font-semibold text-ink">{def.source}</dd></div>
        </dl>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">History</h3>
            <RangeTabs value={range} options={RANGES} onChange={setRange} />
          </div>
          <TrendChart series={series} second={dia} color={r.status === 'green' || r.status === 'stale' ? '#38BDF8' : m.color} height={220} />
          <p className="mt-2 text-xs text-muted">
            {series.baseline ? 'Shaded band = your personal normal range (baseline ± 1.5σ). ' : ''}
            {series.synthetic
              ? series.points.length > 0 && '24-hour view is a synthetic demo profile around today’s value — it is not scored.'
              : abnormal ? `${abnormal} reading${abnormal > 1 ? 's' : ''} outside the normal range (coloured dots).` : 'All readings in this period are within range.'}
            {key === 'bp' && ' Dashed line = diastolic.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { close(); selectZone(def.zone); }} className="flex items-center gap-1.5 rounded-lg bg-raised px-3 py-2 text-sm text-ink hover:bg-canvas"><MapPin size={15} />Show on body</button>
          <button onClick={() => set({ metricDetail: null, view: 'assistant', aiRole: 'doctor' })} className="flex items-center gap-1.5 rounded-lg bg-raised px-3 py-2 text-sm text-ink hover:bg-canvas"><MessageCircle size={15} />Ask Astro AI</button>
        </div>
      </div>
    </Shell>
  );
}

export function Drawers({ d }: { d: ReturnType<typeof useDashboard> }) {
  const metricDetail = useHealthStore((s) => s.metricDetail);
  const selectedZone = useHealthStore((s) => s.selectedZone);
  const selectZone = useHealthStore((s) => s.selectZone);
  return (
    <AnimatePresence>
      {metricDetail && <MetricDrawer key="metric" d={d} />}
      {!metricDetail && selectedZone && (
        <Shell key={`zone-${selectedZone}`} onClose={() => selectZone(null)} label="Organ details">
          <div className="flex min-h-0 flex-1 flex-col [&>aside]:h-full [&>aside]:rounded-none [&>aside]:border-0 sm:[&>aside]:rounded-card">
            <ZonePanel zone={d.result.zones[selectedZone]} env={d.env} status={d.zoneStatus[selectedZone]} />
          </div>
        </Shell>
      )}
    </AnimatePresence>
  );
}
