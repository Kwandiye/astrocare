import {
  ZONE_IDS, SYSTEM_IDS, ZONE_SYSTEM,
  type Astronaut, type Baseline, type DailyTelemetryLog, type Metric, type MetricId, type Syndrome,
  type SystemId, type TriageResult, type TriageStatus, type ZoneId, type ZoneState, type InputSource,
} from '@/types/health';
import { CAREER_DOSE_LIMIT_MSV } from '@/data/astronauts';
import { protocolIdFor } from './protocols';

/**
 * AstroCare triage engine — offline fallback & mock source.
 * When the backend "brain" is connected over WebSocket it is the source of truth; this engine
 * produces the same 3 alert levels so the UI behaves identically.
 *
 * Per-metric status:
 *   z = (value − baseline.mean) / baseline.sd  (astronaut's OWN phase baseline)
 *   |z| ≤ 1.5 → green, 1.5 < |z| ≤ 3.0 → yellow, |z| > 3.0 → red
 *   (only the harmful direction counts for one-sided metrics: e.g. high HRV is never a problem)
 * Absolute hard triggers (NASA-STD-3001 / OCHMO / clinical) override upward.
 */

export const STATUS_RANK: Record<TriageStatus, number> = { stale: -1, green: 0, yellow: 1, red: 2 };
export const worst = (...s: TriageStatus[]): TriageStatus =>
  s.reduce<TriageStatus>((acc, x) => (STATUS_RANK[x] > STATUS_RANK[acc] ? x : acc), 'green');

type Direction = 'up' | 'down' | 'both';
type Hard = { status: Exclude<TriageStatus, 'green' | 'stale'>; reason: string } | null;

export interface MetricDef {
  id: MetricId;
  label: string;
  unit: string;
  zones: ZoneId[];
  /** z = use personal baseline; absolute = thresholds only (environment / binary) */
  mode: 'z' | 'absolute';
  bad: Direction;
  source: InputSource;
  decimals: number;
  get: (l: DailyTelemetryLog) => number;
  hard?: (v: number, l: DailyTelemetryLog) => Hard;
}

const R = (reason: string): Hard => ({ status: 'red', reason });
const Y = (reason: string): Hard => ({ status: 'yellow', reason });

export const METRIC_DEFS: MetricDef[] = [
  // ── heart
  { id: 'hr', label: 'Resting heart rate', unit: 'bpm', zones: ['heart'], mode: 'z', bad: 'both', source: 'wearable', decimals: 0, get: (l) => l.hr,
    hard: (v) => (v > 130 ? R(`Resting HR ${v} bpm > 130`) : v < 40 ? R(`Resting HR ${v} bpm < 40`) : null) },
  { id: 'hrvRmssd', label: 'HRV (RMSSD)', unit: 'ms', zones: ['heart'], mode: 'z', bad: 'down', source: 'wearable', decimals: 0, get: (l) => l.hrvRmssd },
  { id: 'sbp', label: 'Systolic BP', unit: 'mmHg', zones: ['heart'], mode: 'z', bad: 'both', source: 'manual', decimals: 0, get: (l) => l.sbp,
    hard: (v) => (v >= 180 ? R(`SBP ${v} mmHg ≥ 180`) : v < 90 ? R(`SBP ${v} mmHg < 90 (hypotension)`) : null) },
  { id: 'dbp', label: 'Diastolic BP', unit: 'mmHg', zones: ['heart'], mode: 'z', bad: 'both', source: 'manual', decimals: 0, get: (l) => l.dbp,
    hard: (v) => (v >= 120 ? R(`DBP ${v} mmHg ≥ 120`) : null) },
  // ── lungs / environment
  { id: 'spo2', label: 'SpO₂', unit: '%', zones: ['lungs'], mode: 'absolute', bad: 'down', source: 'wearable', decimals: 0, get: (l) => l.spo2,
    hard: (v) => (v < 90 ? R(`SpO₂ ${v}% < 90%`) : v < 94 ? Y(`SpO₂ ${v}% < 94%`) : null) },
  { id: 'respRate', label: 'Respiratory rate', unit: '/min', zones: ['lungs'], mode: 'z', bad: 'both', source: 'wearable', decimals: 0, get: (l) => l.respRate,
    hard: (v) => (v >= 25 || v <= 8 ? R(`Resp. rate ${v}/min out of safe range`) : null) },
  { id: 'ppCO2', label: 'Cabin ppCO₂', unit: 'mmHg', zones: ['lungs'], mode: 'absolute', bad: 'up', source: 'environment', decimals: 1, get: (l) => l.ppCO2,
    hard: (v) => (v >= 7.6 ? R(`ppCO₂ ${v} mmHg ≥ 7.6 (Flight Rule B17-5 emergency)`) : v > 3.0 ? Y(`ppCO₂ ${v} mmHg > 3.0 limit`) : null) },
  // ── brain
  { id: 'sleepHours', label: 'Sleep duration', unit: 'h', zones: ['brain'], mode: 'z', bad: 'down', source: 'wearable', decimals: 1, get: (l) => l.sleepHours,
    hard: (v) => (v < 4 ? R(`Only ${v} h of sleep`) : null) },
  { id: 'sleepEfficiency', label: 'Sleep efficiency', unit: '%', zones: ['brain'], mode: 'z', bad: 'down', source: 'wearable', decimals: 1, get: (l) => l.sleepEfficiency,
    hard: (v) => (v < 89.2 ? Y(`Sleep efficiency ${v}% < 89.2%`) : null) },
  { id: 'pvtWorst10Ms', label: 'PVT-B worst 10 %', unit: 'ms', zones: ['brain'], mode: 'z', bad: 'up', source: 'manual', decimals: 0, get: (l) => l.pvtWorst10Ms,
    hard: (v) => (v > 500 ? Y(`Reaction time ${v} ms > 500 ms`) : null) },
  { id: 'stressVas', label: 'Stress (VAS)', unit: '/100', zones: ['brain'], mode: 'z', bad: 'up', source: 'manual', decimals: 0, get: (l) => l.stressVas },
  { id: 'mood', label: 'Mood', unit: '/5', zones: ['brain'], mode: 'z', bad: 'down', source: 'manual', decimals: 0, get: (l) => l.mood,
    hard: (v) => (v <= 1 ? Y('Very low mood reported') : null) },
  // ── eyes / vestibular
  { id: 'iop', label: 'Intraocular pressure', unit: 'mmHg', zones: ['eyes'], mode: 'z', bad: 'up', source: 'manual', decimals: 1, get: (l) => l.iop,
    hard: (v) => (v > 21 ? Y(`IOP ${v} mmHg > 21`) : null) },
  { id: 'opticDiscEdema', label: 'Optic disc edema (OCT)', unit: '', zones: ['eyes'], mode: 'absolute', bad: 'up', source: 'camera', decimals: 0, get: (l) => (l.opticDiscEdema ? 1 : 0),
    hard: (v) => (v >= 1 ? R('Optic disc edema detected (SANS)') : null) },
  { id: 'motionSickness', label: 'Motion sickness', unit: '/10', zones: ['inner_ear'], mode: 'absolute', bad: 'up', source: 'manual', decimals: 0, get: (l) => l.motionSickness,
    hard: (v) => (v >= 7 ? R(`Severe motion sickness (${v}/10)`) : v >= 4 ? Y(`Motion sickness ${v}/10`) : null) },
  // ── GI / metabolic
  { id: 'kcalIntake', label: 'Energy intake', unit: 'kcal', zones: ['stomach_gi'], mode: 'z', bad: 'down', source: 'manual', decimals: 0, get: (l) => l.kcalIntake },
  { id: 'proteinG', label: 'Protein intake', unit: 'g', zones: ['stomach_gi'], mode: 'z', bad: 'down', source: 'manual', decimals: 0, get: (l) => l.proteinG,
    hard: (v) => (v < 70 ? Y(`Protein ${v} g < 70 g`) : null) },
  { id: 'bodyMassKg', label: 'Body mass', unit: 'kg', zones: ['stomach_gi'], mode: 'z', bad: 'down', source: 'manual', decimals: 1, get: (l) => l.bodyMassKg },
  { id: 'glucose', label: 'Blood glucose', unit: 'mg/dL', zones: ['pancreas', 'liver'], mode: 'z', bad: 'both', source: 'manual', decimals: 0, get: (l) => l.glucose,
    hard: (v) => (v < 54 ? R(`Glucose ${v} mg/dL < 54 (hypoglycemia)`) : v > 250 ? R(`Glucose ${v} mg/dL > 250`)
      : v < 70 ? Y(`Glucose ${v} mg/dL < 70`) : v > 180 ? Y(`Glucose ${v} mg/dL > 180`) : null) },
  { id: 'hydrationMl', label: 'Fluid intake', unit: 'mL', zones: ['kidneys'], mode: 'absolute', bad: 'down', source: 'manual', decimals: 0, get: (l) => l.hydrationMl,
    hard: (v) => (v < 1200 ? R(`Fluid intake ${v} mL < 1.2 L (stone risk)`) : v < 2000 ? Y(`Fluid intake ${v} mL < 2.0 L (stone risk)`) : null) },
  // ── musculoskeletal
  { id: 'bmdLossRatePctMonth', label: 'Bone loss rate (hip/spine)', unit: '%/mo', zones: ['skeleton_lower', 'spine'], mode: 'absolute', bad: 'up', source: 'manual', decimals: 2,
    get: (l) => l.bmdLossRatePctMonth,
    hard: (v) => (v > 1.5 ? R(`BMD loss ${v} %/month > 1.5`) : v > 1.0 ? Y(`BMD loss ${v} %/month > 1.0`) : null) },
  { id: 'bmdUpperRatePctMonth', label: 'Bone loss rate (upper body)', unit: '%/mo', zones: ['skeleton_upper'], mode: 'absolute', bad: 'up', source: 'manual', decimals: 2,
    get: (l) => Math.round(l.bmdLossRatePctMonth * 25) / 100,
    hard: (v) => (v > 0.6 ? Y(`Upper-body BMD loss ${v} %/month`) : null) },
  { id: 'exerciseMinutes', label: 'Exercise (aerobic + ARED)', unit: 'min', zones: ['muscles_legs'], mode: 'absolute', bad: 'down', source: 'wearable', decimals: 0, get: (l) => l.exerciseMinutes,
    hard: (v) => (v < 45 ? Y(`Only ${v} min exercise (target ≥ 90)`) : null) },
  { id: 'resistanceMinutes', label: 'Resistance training', unit: 'min', zones: ['muscles_arms'], mode: 'absolute', bad: 'down', source: 'wearable', decimals: 0, get: (l) => l.resistanceMinutes,
    hard: (v) => (v < 20 ? Y(`Resistance training ${v} min < 20`) : null) },
  // ── skin / immune / radiation
  { id: 'skinTemp', label: 'Skin temperature', unit: '°C', zones: ['skin_immune'], mode: 'z', bad: 'both', source: 'wearable', decimals: 1, get: (l) => l.skinTemp },
  { id: 'coreTemp', label: 'Core temperature', unit: '°C', zones: ['skin_immune'], mode: 'z', bad: 'both', source: 'wearable', decimals: 1, get: (l) => l.coreTemp,
    hard: (v) => (v >= 39 ? R(`Core temp ${v} °C ≥ 39.0`) : v < 35 ? R(`Core temp ${v} °C < 35.0`) : v >= 38 ? Y(`Fever ${v} °C`) : null) },
  { id: 'radiationMsvDay', label: 'Radiation dose today', unit: 'mSv', zones: ['skin_immune'], mode: 'absolute', bad: 'up', source: 'environment', decimals: 2, get: (l) => l.radiationMsvDay,
    hard: (v, l) => {
      // thresholds scale with the environment's normal background (ISS ≈ 0.55 mSv/day, deep space ≈ 1.6)
      const base = l.envRadiationBaseline ?? 0.55;
      const red = Math.max(5, base * 5);
      const yellow = Math.max(1, base * 1.8);
      return v >= red ? R(`Radiation ${v} mSv/day ≥ ${red.toFixed(1)} (solar particle event)`) : v > yellow ? Y(`Radiation ${v} mSv/day > ${yellow.toFixed(1)}`) : null;
    } },
  { id: 'cumulativeDoseMsv', label: 'Cumulative mission dose', unit: 'mSv', zones: ['skin_immune'], mode: 'absolute', bad: 'up', source: 'environment', decimals: 1, get: (l) => l.cumulativeDoseMsv,
    hard: (v) => (v > 0.8 * CAREER_DOSE_LIMIT_MSV ? R(`Dose ${v} mSv > 80% of career limit`) : v > 0.5 * CAREER_DOSE_LIMIT_MSV ? Y(`Dose ${v} mSv > 50% of career limit`) : null) },
];

export const metricDef = (id: MetricId) => METRIC_DEFS.find((m) => m.id === id);

export function zStatus(z: number, bad: Direction): TriageStatus {
  const harmful = bad === 'both' ? Math.abs(z) : bad === 'up' ? z : -z;
  if (harmful > 3.0) return 'red';
  if (harmful > 1.5) return 'yellow';
  return 'green';
}

export function phaseBaselines(a: Astronaut, l: DailyTelemetryLog) {
  return l.phase === 'phase1_adaptation' ? a.baselines.phase1_adaptation : a.baselines.phase2_longduration;
}

const fmt = (v: number, d: number) => (d === 0 ? Math.round(v).toString() : v.toFixed(d));

export function evaluateMetric(def: MetricDef, a: Astronaut, l: DailyTelemetryLog, history: DailyTelemetryLog[]): Metric {
  const value = def.get(l);
  const baseline: Baseline | null = def.mode === 'z' ? phaseBaselines(a, l)[def.id] ?? null : null;
  let zScore: number | null = null;
  let deviationPct: number | null = null;
  let status: TriageStatus = 'green';
  let reason: string | null = null;
  if (baseline) {
    zScore = (value - baseline.mean) / baseline.sd;
    deviationPct = ((value - baseline.mean) / baseline.mean) * 100;
    status = zStatus(zScore, def.bad);
    if (status !== 'green') {
      const dir = zScore > 0 ? 'above' : 'below';
      reason = `${def.label} ${fmt(value, def.decimals)} ${def.unit} is ${Math.abs(zScore).toFixed(1)}σ ${dir} your baseline`;
    }
  }
  const h = def.hard?.(value, l) ?? null;
  if (h && STATUS_RANK[h.status] >= STATUS_RANK[status]) { status = h.status; reason = h.reason; }
  return {
    id: def.id, label: def.label, unit: def.unit, value, baseline, zScore, deviationPct, status, reason,
    trend7d: [...history.map((x) => def.get(x)), value],
    source: def.source,
  };
}

/**
 * Mission Fatigue Index (0–100). Mean of 5 sub-scores; each = adverse deviation / σ-scale × 25, clamped 0–100.
 * σ-scales: HR 4.0 bpm, RMSSD 6.0 ms, PVT 45 ms, sleep efficiency 2.0 %, ppCO₂ 1.5 mmHg (above 2.5 target).
 * MFI ≥ 65 → RED, 30–65 → YELLOW.
 */
export function computeMFI(a: Astronaut, l: DailyTelemetryLog): number {
  const b = phaseBaselines(a, l);
  const sub = (adverse: number, scale: number) => Math.min(100, Math.max(0, (adverse / scale) * 25));
  const parts = [
    sub(l.hr - (b.hr?.mean ?? 62), 4.0),
    sub((b.hrvRmssd?.mean ?? 48) - l.hrvRmssd, 6.0),
    sub(l.pvtWorst10Ms - (b.pvtWorst10Ms?.mean ?? 420), 45),
    sub((b.sleepEfficiency?.mean ?? 91.8) - l.sleepEfficiency, 2.0),
    sub(l.ppCO2 - 2.5, 1.5),
  ];
  return Math.round(parts.reduce((s, x) => s + x, 0) / parts.length);
}

export const mfiStatus = (mfi: number): TriageStatus => (mfi >= 65 ? 'red' : mfi >= 30 ? 'yellow' : 'green');

function mfiMetric(mfi: number, a: Astronaut, history: DailyTelemetryLog[]): Metric {
  const status = mfiStatus(mfi);
  return {
    id: 'mfi', label: 'Mission Fatigue Index', unit: '/100', value: mfi, baseline: null, zScore: null, deviationPct: null,
    status, reason: status === 'green' ? null : `Mission Fatigue Index ${mfi}/100 ${status === 'red' ? '≥ 65' : '≥ 30'}`,
    trend7d: [...history.map((h) => computeMFI(a, h)), mfi], source: 'manual',
  };
}

function painMetric(v: number): Metric {
  const status: TriageStatus = v >= 7 ? 'red' : v >= 4 ? 'yellow' : 'green';
  return {
    id: 'pain', label: 'Reported pain', unit: '/10', value: v, baseline: null, zScore: null, deviationPct: null,
    status, reason: status === 'green' ? null : `Pain ${v}/10 reported in check-in`, trend7d: [v], source: 'manual',
  };
}

/** Multi-signal fusion → named syndromes with explanation strings. */
export function detectSyndromes(l: DailyTelemetryLog, metrics: Map<MetricId, Metric>, mfi: number): Syndrome[] {
  const out: Syndrome[] = [];
  const m = (id: MetricId) => metrics.get(id);
  const bad = (id: MetricId) => (m(id)?.status ?? 'green') !== 'green';

  if (l.ppCO2 > 3.0 && (bad('pvtWorst10Ms') || bad('sleepEfficiency'))) {
    const red = l.ppCO2 >= 7.6 || l.pvtWorst10Ms > 600;
    out.push({
      id: 'hypercapnic_fatigue', name: 'Hypercapnic neuro-cognitive fatigue', status: red ? 'red' : 'yellow', zones: ['lungs', 'brain'],
      explanation: `High ppCO₂ (${l.ppCO2} mmHg) + poor sleep (${l.sleepEfficiency}%) + slow PVT (${l.pvtWorst10Ms} ms) → CO₂-driven fatigue and slowed cognition`,
    });
  }
  if (l.phase === 'postflight' && l.sbp < 100 && bad('hr')) {
    out.push({ id: 'orthostatic', name: 'Orthostatic intolerance risk', status: 'yellow', zones: ['heart', 'brain'],
      explanation: `HR elevated (${l.hr} bpm) with low SBP (${l.sbp} mmHg) after return to gravity → risk of fainting when standing` });
  }
  if (l.exerciseMinutes > 180 && (m('hrvRmssd')?.zScore ?? 0) < -1 && (bad('sleepEfficiency') || bad('sleepHours'))) {
    out.push({ id: 'overtraining', name: 'Overtraining / poor recovery', status: 'yellow', zones: ['muscles_legs', 'heart', 'brain'],
      explanation: `High load (${l.exerciseMinutes} min) + HRV ${l.hrvRmssd} ms below baseline + short sleep → body is not recovering` });
  }
  if (l.radiationMsvDay > 1 && (mfi >= 30 || (m('coreTemp')?.zScore ?? 0) > 1)) {
    out.push({ id: 'radiation_stress', name: 'Radiation exposure stress', status: l.radiationMsvDay >= 5 ? 'red' : 'yellow', zones: ['skin_immune', 'brain'],
      explanation: `Dose spike ${l.radiationMsvDay} mSv/day + fatigue (MFI ${mfi}) + temp ${l.coreTemp} °C → follow shielding protocol, watch for nausea` });
  }
  if (bad('iop') || l.opticDiscEdema) {
    out.push({ id: 'sans', name: 'Spaceflight-Associated Neuro-ocular Syndrome', status: l.opticDiscEdema ? 'red' : 'yellow', zones: ['eyes', 'brain'],
      explanation: `IOP ${l.iop} mmHg rising${l.opticDiscEdema ? ' + optic disc edema on OCT' : ''} → headward fluid shift is affecting the eye` });
  }
  if (l.bmdLossRatePctMonth > 1.0 && l.hydrationMl < 2000) {
    out.push({ id: 'stone_risk', name: 'Kidney-stone risk (bone calcium + low fluids)', status: 'yellow', zones: ['kidneys', 'skeleton_lower'],
      explanation: `Bone loss ${l.bmdLossRatePctMonth} %/mo releases calcium + fluid intake only ${l.hydrationMl} mL → urine supersaturation` });
  }
  return out;
}

/** Full triage for one astronaut-day. `history` = previous days (oldest first, ≤ 7). */
export function triage(a: Astronaut, log: DailyTelemetryLog, history: DailyTelemetryLog[] = []): TriageResult {
  const metricsById = new Map<MetricId, Metric>();
  const zoneMetrics = Object.fromEntries(ZONE_IDS.map((z) => [z, [] as Metric[]])) as Record<ZoneId, Metric[]>;

  for (const def of METRIC_DEFS) {
    const met = evaluateMetric(def, a, log, history);
    metricsById.set(def.id, met);
    for (const z of def.zones) zoneMetrics[z].push(met);
  }
  const mfi = computeMFI(a, log);
  const mfiM = mfiMetric(mfi, a, history);
  metricsById.set('mfi', mfiM);
  zoneMetrics.brain.push(mfiM);

  for (const [z, v] of Object.entries(log.pain) as [ZoneId, number][]) {
    if (v > 0) zoneMetrics[z].push(painMetric(v));
  }

  const syndromes = detectSyndromes(log, metricsById, mfi);

  const zones = {} as Record<ZoneId, ZoneState>;
  for (const z of ZONE_IDS) {
    const ms = zoneMetrics[z];
    const synd = syndromes.filter((s) => s.zones.includes(z));
    const status = worst(...ms.map((m) => m.status));
    const drivers = [
      ...ms.filter((m) => m.status !== 'green' && m.reason).sort((x, y) => STATUS_RANK[y.status] - STATUS_RANK[x.status]).map((m) => m.reason!),
      ...synd.map((s) => `${s.name}: ${s.explanation}`),
    ];
    const driver = ms.reduce<Metric | undefined>((acc, m) => (!acc || STATUS_RANK[m.status] > STATUS_RANK[acc.status] ? m : acc), undefined);
    zones[z] = { zoneId: z, system: ZONE_SYSTEM[z], status, metrics: ms, drivers, protocolId: protocolIdFor(z, status, driver?.id) };
  }

  const systems = Object.fromEntries(SYSTEM_IDS.map((s) => [s, 'green'])) as Record<SystemId, TriageStatus>;
  for (const z of ZONE_IDS) systems[ZONE_SYSTEM[z]] = worst(systems[ZONE_SYSTEM[z]], zones[z].status);

  return {
    astronautId: a.id, missionDay: log.missionDay, phase: log.phase,
    overall: worst(...ZONE_IDS.map((z) => zones[z].status)),
    zones, systems, mfi, syndromes,
  };
}
