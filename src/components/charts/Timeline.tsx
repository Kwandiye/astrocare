'use client';
import { useMemo, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { useHealthStore } from '@/store/useHealthStore';
import { getMissionSeries } from '@/data/generator';
import { astronautById, PHASE1_END_DAY } from '@/data/astronauts';
import { applyEnvironment } from '@/lib/simulator';
import { triage, METRIC_DEFS, phaseBaselines } from '@/lib/triageEngine';
import { STATUS_META } from '@/lib/status';
import type { MetricId, MissionEventType } from '@/types/health';

const EVENT_LABEL: Record<MissionEventType, string> = {
  eva: 'EVA', spe: 'Solar particle event', cdra_failure: 'CO₂ scrubber fail', circadian_shift: 'Slam shift', skipped_exercise: 'Skipped exercise', sans_exam: 'Eye exam',
};
const LIVE_KEY: Partial<Record<MetricId, string>> = { hr: 'hr', spo2: 'spo2', respRate: 'resp_rate', coreTemp: 'temp_c', sbp: 'bp_sys', glucose: 'glucose_mgdl', radiationMsvDay: 'radiation_dose_rate' };
type Range = 'live' | '7d' | '30d' | 'mission';

export function Timeline() {
  const astronautId = useHealthStore((s) => s.astronautId);
  const envId = useHealthStore((s) => s.envId);
  const day = useHealthStore((s) => s.day);
  const setDay = useHealthStore((s) => s.setDay);
  const ticks = useHealthStore((s) => s.ticks);
  const [metric, setMetric] = useState<MetricId>('hr');
  const [range, setRange] = useState<Range>('30d');
  const a = astronautById(astronautId);

  const days = useMemo(() => {
    const series = getMissionSeries(astronautId).map((l) => applyEnvironment(l, envId));
    return series.map((l, i) => ({ log: l, status: triage(a, l, series.slice(Math.max(0, i - 7), i)).overall }));
  }, [astronautId, envId, a]);

  const def = METRIC_DEFS.find((m) => m.id === metric)!;
  const [from, to] = range === '7d' ? [Math.max(0, day - 7), day] : range === '30d' ? [Math.max(0, day - 30), day] : [0, 180];
  const data = useMemo(() => {
    if (range === 'live') {
      const k = LIVE_KEY[metric];
      return k ? ticks.slice(-600).map((t, i) => ({ x: i - Math.min(600, ticks.length) + 1, v: t.rawVitals[k] as number })) : [];
    }
    return days.slice(from, to + 1).map(({ log }) => ({ x: log.missionDay, v: def.get(log) }));
  }, [range, ticks, metric, days, from, to, def]);

  const bl = phaseBaselines(a, days[day].log)[metric];
  const events = range === 'live' ? [] : days.slice(from, to + 1).flatMap(({ log }) => log.events.filter((e) => e !== 'sans_exam').map((e) => ({ d: log.missionDay, e })));

  return (
    <section className="glass rounded-xl p-3" aria-label="Mission timeline">
      {/* status heat-strip across the mission */}
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-semibold uppercase tracking-wider">Mission timeline · {a.name}</span>
        <span>Day 0 → 180 · click a day</span>
      </div>
      <div className="flex h-5 w-full overflow-hidden rounded" role="list">
        {days.map(({ log, status }) => (
          <button key={log.missionDay} role="listitem" onClick={() => setDay(log.missionDay)} title={`Day ${log.missionDay}: ${STATUS_META[status].label}${log.events.length ? ' · ' + log.events.map((e) => EVENT_LABEL[e]).join(', ') : ''}`}
            className="relative h-full flex-1" style={{ background: STATUS_META[status].color, opacity: log.missionDay === day ? 1 : status === 'green' ? 0.35 : 0.8 }}
            aria-label={`Day ${log.missionDay} ${STATUS_META[status].label}`}>
            {log.missionDay === day && <span className="absolute inset-0 ring-2 ring-white" />}
            {log.events.some((e) => e === 'eva' || e === 'spe' || e === 'cdra_failure') && <span className="absolute left-1/2 top-0 h-1.5 w-px bg-white" />}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={metric} onChange={(e) => setMetric(e.target.value as MetricId)} className="rounded bg-slate-900 px-2 py-1 text-xs ring-1 ring-slate-700" aria-label="Metric">
          {METRIC_DEFS.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.unit})</option>)}
        </select>
        <div className="flex rounded bg-slate-900 p-0.5 text-xs">
          {(['live', '7d', '30d', 'mission'] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded px-2 py-0.5 ${range === r ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400'}`}>{r === 'live' ? '10 min live' : r}</button>
          ))}
        </div>
        {bl && <span className="text-[11px] text-slate-500">green band = your baseline μ ± 1.5σ ({bl.mean} ± {(1.5 * bl.sd).toFixed(1)} {def.unit})</span>}
      </div>

      <div className="mt-2 h-44">
        {data.length === 0 ? <div className="flex h-full items-center justify-center text-xs text-slate-500">This metric is daily — choose 7d / 30d / mission.</div> : (
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" />
              <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: '#64748B', fontSize: 10 }} tickFormatter={(v) => (range === 'live' ? `${v}s` : `D${v}`)} />
              <YAxis tick={{ fill: '#64748B', fontSize: 10 }} domain={['auto', 'auto']} />
              {bl && <>
                <ReferenceArea y1={bl.mean - 3 * bl.sd} y2={bl.mean - 1.5 * bl.sd} fill="#F59E0B" fillOpacity={0.06} />
                <ReferenceArea y1={bl.mean + 1.5 * bl.sd} y2={bl.mean + 3 * bl.sd} fill="#F59E0B" fillOpacity={0.06} />
                <ReferenceArea y1={bl.mean - 1.5 * bl.sd} y2={bl.mean + 1.5 * bl.sd} fill="#22C55E" fillOpacity={0.12} />
              </>}
              {range !== 'live' && from <= PHASE1_END_DAY && to >= PHASE1_END_DAY && <ReferenceLine x={PHASE1_END_DAY} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: 'Phase 2', fill: '#94A3B8', fontSize: 10, position: 'insideTopRight' }} />}
              {range !== 'live' && <ReferenceLine x={day} stroke="#38BDF8" />}
              {events.map(({ d, e }, i) => <ReferenceLine key={`${d}${e}${i}`} x={d} stroke="#F472B6" strokeDasharray="2 2" label={{ value: EVENT_LABEL[e], fill: '#F9A8D4', fontSize: 9, position: 'insideTopLeft', angle: 0 }} />)}
              <Tooltip contentStyle={{ background: '#141E2D', border: '1px solid #22304A', fontSize: 11 }} labelFormatter={(v) => (range === 'live' ? `${v}s` : `Day ${v}`)} formatter={(v: number) => [`${v} ${def.unit}`, def.label]} />
              <Line dataKey="v" stroke="#38BDF8" strokeWidth={2} dot={range === '7d'} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
