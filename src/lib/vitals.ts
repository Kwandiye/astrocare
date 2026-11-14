import type { MetricId, TriageStatus, ZoneId, Baseline } from '@/types/health';
import type { BrainTick } from '@/types/brain';
import type { VitalKey } from '@/store/useHealthStore';
import { RANGES, bandStatus } from '@/lib/ranges';
import { worst } from '@/lib/triageEngine';

/**
 * The six primary vital signs shown on the Overview. Everything here is a view over existing data:
 * live values come from the brain tick, status combines the brain's flags, the triage engine (personal
 * baseline + NASA hard limits) and the NEWS2-adapted visual bands. No new thresholds are introduced.
 */
export interface VitalDef {
  key: VitalKey; label: string; unit: string; metric: MetricId; liveKey: string; rangeKey: string; zone: ZoneId;
  term?: string; source: string; decimals: number;
}

export const VITALS: VitalDef[] = [
  { key: 'hr', label: 'Heart Rate', unit: 'bpm', metric: 'hr', liveKey: 'hr', rangeKey: 'hr', zone: 'heart', source: 'Wearable', decimals: 0 },
  { key: 'bp', label: 'Blood Pressure', unit: 'mmHg', metric: 'sbp', liveKey: 'bp_sys', rangeKey: 'bp_sys', zone: 'heart', source: 'Cuff', decimals: 0 },
  { key: 'spo2', label: 'Blood Oxygen', unit: '%', metric: 'spo2', liveKey: 'spo2', rangeKey: 'spo2', zone: 'lungs', term: 'SpO₂', source: 'Pulse oximeter', decimals: 0 },
  { key: 'resp', label: 'Respiratory Rate', unit: 'br/min', metric: 'respRate', liveKey: 'resp_rate', rangeKey: 'resp_rate', zone: 'lungs', source: 'Bio-Monitor', decimals: 0 },
  { key: 'temp', label: 'Body Temperature', unit: '°C', metric: 'coreTemp', liveKey: 'temp_c', rangeKey: 'temp_c', zone: 'skin_immune', source: 'Core sensor', decimals: 1 },
  { key: 'glucose', label: 'Blood Glucose', unit: 'mg/dL', metric: 'glucose', liveKey: 'glucose_mgdl', rangeKey: 'glucose_mgdl', zone: 'pancreas', source: 'Glucometer', decimals: 0 },
];
export const vitalByKey = (k: VitalKey) => VITALS.find((v) => v.key === k)!;

/** Brain flag metric names that belong to each vital. */
const FLAG_METRICS: Record<VitalKey, string[]> = {
  hr: ['hr'], bp: ['sbp', 'dbp'], spo2: ['spo2'], resp: ['respRate'], temp: ['coreTemp'], glucose: ['glucose'],
};

export interface VitalReading {
  def: VitalDef;
  value: number;          // primary numeric (systolic for BP)
  display: string;        // formatted (e.g. "118/76")
  unit: string;
  status: TriageStatus;
  series: number[];       // live ticks
  baseline: Baseline | null;
  deltaPct: number | null;
  normalText: string;     // plain-language reference
  reason: string | null;
}

interface Ctx {
  tick: BrainTick | null; ticks: BrainTick[]; stale: boolean;
  log: { sbp: number; dbp: number; glucose: number } & Record<string, unknown>;
  metrics: Map<MetricId, { status: TriageStatus; baseline: Baseline | null; reason: string | null }>;
  glucoseUnit: 'mg/dL' | 'mmol/L';
}

export function readVital(def: VitalDef, c: Ctx): VitalReading {
  const raw = c.tick?.rawVitals ?? null;
  const live = (k: string) => (raw?.[k] as number | undefined);
  let value = live(def.liveKey) ?? (def.key === 'bp' ? c.log.sbp : def.key === 'glucose' ? c.log.glucose : NaN);
  if (!Number.isFinite(value)) value = NaN;
  const series = c.ticks.map((t) => t.rawVitals[def.liveKey] as number | undefined).filter((x): x is number => typeof x === 'number');

  const m = c.metrics.get(def.metric);
  const flags = c.tick?.activeFlags.filter((f) => f.metric && FLAG_METRICS[def.key].includes(f.metric)) ?? [];
  const flagStatus: TriageStatus = flags.some((f) => f.severity === 'critical') ? 'red' : flags.length ? 'yellow' : 'green';
  let status = worst(flagStatus, Number.isFinite(value) ? bandStatus(RANGES[def.rangeKey], value) : 'green');
  if (def.key === 'bp') status = worst(status, c.metrics.get('dbp')?.status ?? 'green');
  if (c.stale || !Number.isFinite(value)) status = 'stale';

  const baseline = m?.baseline ?? null;
  const deltaPct = baseline && Number.isFinite(value) ? ((value - baseline.mean) / baseline.mean) * 100 : null;

  let display = Number.isFinite(value) ? value.toFixed(def.decimals) : '—';
  let unit = def.unit;
  if (def.key === 'bp') display = `${Math.round(value)}/${Math.round(live('bp_dia') ?? c.log.dbp)}`;
  if (def.key === 'glucose' && c.glucoseUnit === 'mmol/L') { display = (value / 18).toFixed(1); unit = 'mmol/L'; }

  const green = RANGES[def.rangeKey].bands.find((b) => b.status === 'green')!;
  const normalText = baseline
    ? `Your baseline ${baseline.mean.toFixed(def.decimals)} ${def.unit}`
    : `Normal ${green.from}–${green.to} ${def.unit}`;

  return { def, value, display, unit, status, series, baseline, deltaPct, normalText, reason: flags[0]?.reason ?? m?.reason ?? null };
}
