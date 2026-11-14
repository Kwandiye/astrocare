import type { Astronaut, DailyTelemetryLog, MetricId, TriageStatus, Baseline } from '@/types/health';
import { metricDef, evaluateMetric, phaseBaselines } from '@/lib/triageEngine';

export type TimeRange = '24h' | '7d' | '30d';
export interface Point { x: number; label: string; v: number; status: TriageStatus }
export interface Series { points: Point[]; baseline: Baseline | null; synthetic: boolean; unit: string; label: string }

/** Metrics measured continuously, for which an intraday (24 h) profile makes sense. */
const INTRADAY: Partial<Record<MetricId, (h: number) => number>> = {
  // circadian shapes (trough ≈ 04:00), amplitude in metric units
  hr: (h) => 5 * Math.sin(((h - 10) / 24) * 2 * Math.PI),
  sbp: (h) => 6 * Math.sin(((h - 10) / 24) * 2 * Math.PI),
  dbp: (h) => 4 * Math.sin(((h - 10) / 24) * 2 * Math.PI),
  respRate: (h) => 1 * Math.sin(((h - 10) / 24) * 2 * Math.PI),
  spo2: (h) => (h >= 23 || h < 6 ? -0.6 : 0.2),
  coreTemp: (h) => 0.35 * Math.sin(((h - 10) / 24) * 2 * Math.PI),
  // post-meal rises at 08:00, 13:00, 19:00
  glucose: (h) => [8, 13, 19].reduce((s, m) => s + (h >= m ? 28 * Math.exp(-(h - m) / 1.2) : 0), -8),
};
export const hasIntraday = (m: MetricId) => m in INTRADAY;

function jitter(seed: number) { const x = Math.sin(seed * 78.233) * 43758.5453; return (x - Math.floor(x) - 0.5) * 2; }

/**
 * Time series for one metric. 7 d / 30 d use the daily mission log (same data the triage engine sees);
 * 24 h is a synthetic circadian profile around today's value, flagged `synthetic` so the UI can label it.
 * Each point is scored with the existing triage rules (personal baseline + hard limits).
 */
export function metricSeries(a: Astronaut, mission: DailyTelemetryLog[], day: number, metric: MetricId, range: TimeRange): Series {
  const def = metricDef(metric)!;
  const today = mission[Math.min(day, mission.length - 1)];
  const baseline = def.mode === 'z' ? phaseBaselines(a, today)[metric] ?? null : null;

  if (range === '24h') {
    const shape = INTRADAY[metric];
    if (!shape) return { points: [], baseline, synthetic: true, unit: def.unit, label: def.label };
    const base = def.get(today);
    const points = Array.from({ length: 25 }, (_, i) => {
      const h = i % 24;
      const v = +(base + shape(h) + jitter(day * 100 + i + metric.length) * (Math.abs(base) * 0.008)).toFixed(def.decimals);
      // synthetic points are never scored: demo values must not create warnings that look like real readings
      return { x: i - 24, label: `${String(h).padStart(2, '0')}:00`, v, status: 'green' as TriageStatus };
    });
    return { points, baseline, synthetic: true, unit: def.unit, label: def.label };
  }
  const n = range === '7d' ? 7 : 30;
  const from = Math.max(0, day - n + 1);
  const points = mission.slice(from, day + 1).map((log) => {
    const v = +def.get(log).toFixed(def.decimals);
    return { x: log.missionDay, label: `Day ${log.missionDay}`, v, status: evaluateMetric(def, a, log, []).status };
  });
  return { points, baseline, synthetic: false, unit: def.unit, label: def.label };
}
