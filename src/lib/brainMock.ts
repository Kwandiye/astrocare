import type { BrainFlag, BrainTick } from '@/types/brain';
import type { DailyTelemetryLog, Metric, MetricId, TriageResult, ZoneId } from '@/types/health';
import { ZONE_IDS } from '@/types/health';
import { astronautById } from '@/data/astronauts';
import { getLog, getHistory } from '@/data/generator';
import { triage, STATUS_RANK } from './triageEngine';
import { getProtocol } from './protocols';
import { effectiveLog, effectiveHistory, type Overrides, type WhatIfId } from './simulator';
import type { EnvironmentId } from './environments';

/**
 * Mock "brain": produces ticks with EXACTLY the backend contract, computed by the local triage engine.
 * Used in-browser when no WebSocket backend is reachable, and by scripts/mock-brain.ts.
 */

const FLAG_TYPE: Partial<Record<MetricId, BrainFlag['type']>> = {
  radiationMsvDay: 'radiation', cumulativeDoseMsv: 'radiation',
  sleepHours: 'sleep', sleepEfficiency: 'sleep', pvtWorst10Ms: 'sleep', mfi: 'sleep',
  mood: 'mood', stressVas: 'mood',
  kcalIntake: 'nutrition', proteinG: 'nutrition', bodyMassKg: 'nutrition', hydrationMl: 'nutrition',
  exerciseMinutes: 'exercise', resistanceMinutes: 'exercise',
};

/** Thresholds for absolute metrics (for "value vs threshold" display). */
const ABS_THRESHOLDS: Partial<Record<MetricId, { yellow: number; red: number; normal: [number, number] }>> = {
  ppCO2: { yellow: 3.0, red: 7.6, normal: [0, 2.5] },
  spo2: { yellow: 94, red: 90, normal: [96, 100] },
  radiationMsvDay: { yellow: 1, red: 5, normal: [0, 0.7] },
  motionSickness: { yellow: 4, red: 7, normal: [0, 3] },
  hydrationMl: { yellow: 2000, red: 1200, normal: [2500, 4000] },
  bmdLossRatePctMonth: { yellow: 1.0, red: 1.5, normal: [0, 1.0] },
  exerciseMinutes: { yellow: 45, red: 0, normal: [90, 180] },
  resistanceMinutes: { yellow: 20, red: 0, normal: [30, 60] },
  mfi: { yellow: 30, red: 65, normal: [0, 30] },
  opticDiscEdema: { yellow: 1, red: 1, normal: [0, 0] },
};

const ZONE_PRIORITY: ZoneId[] = ['lungs', 'heart', 'brain', 'skin_immune', 'eyes', 'pancreas', 'kidneys', 'inner_ear', ...ZONE_IDS];

function metricToFlag(m: Metric, zone: ZoneId): BrainFlag {
  const sev = m.status === 'red' ? 'critical' : 'warning';
  let threshold: number | undefined;
  let normalRange: [number, number] | undefined;
  if (m.baseline) {
    const k = m.status === 'red' ? 3 : 1.5;
    const up = (m.zScore ?? 0) > 0;
    threshold = Math.round((m.baseline.mean + (up ? k : -k) * m.baseline.sd) * 10) / 10;
    normalRange = [Math.round((m.baseline.mean - 1.5 * m.baseline.sd) * 10) / 10, Math.round((m.baseline.mean + 1.5 * m.baseline.sd) * 10) / 10];
  } else {
    const t = ABS_THRESHOLDS[m.id];
    if (t) { threshold = m.status === 'red' ? t.red : t.yellow; normalRange = t.normal; }
  }
  return {
    type: FLAG_TYPE[m.id] ?? 'vitals', severity: sev, reason: m.reason ?? m.label,
    triggeredValue: m.value, metric: m.id, zone, threshold, unit: m.unit, normalRange,
    deviationPct: m.deviationPct != null ? Math.round(m.deviationPct * 10) / 10 : undefined,
  };
}

export function tickFromTriage(t: TriageResult, log: DailyTelemetryLog, seq: number, env?: string): BrainTick {
  const seen = new Set<string>();
  const flags: BrainFlag[] = [];
  for (const z of ZONE_PRIORITY) {
    for (const m of t.zones[z].metrics) {
      if (m.status === 'green' || m.status === 'stale' || seen.has(m.id)) continue;
      seen.add(m.id);
      flags.push(metricToFlag(m, z));
    }
  }
  flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1));

  const worstZone = ZONE_PRIORITY.find((z) => t.zones[z].status === t.overall && t.overall !== 'green');
  const proto = worstZone ? getProtocol(t.zones[worstZone].protocolId) : null;
  const alertLevel = t.overall === 'stale' ? 'green' : t.overall;
  const doctorRecommendation = proto
    ? `${proto.title}. ${proto.steps[0].text} ${proto.steps[1]?.text ?? ''}`.trim()
    : 'All parameters within your personal baseline. Continue the planned schedule and stay hydrated.';

  return {
    seq, astronautId: log.astronautId, missionDay: log.missionDay, environment: env,
    timestamp: new Date().toISOString(),
    alertLevel,
    activeFlags: flags,
    rawVitals: {
      hr: log.hr, spo2: log.spo2, temp_c: log.coreTemp, resp_rate: log.respRate,
      radiation_dose_rate: log.radiationMsvDay, bp_sys: log.sbp, bp_dia: log.dbp, glucose_mgdl: log.glucose,
      radiation_cumulative_msv: log.cumulativeDoseMsv,
    },
    doctorRecommendation,
    steps: proto?.steps.map((s) => ({ text: s.text, durationMin: s.durationMin, escalation: s.isEscalation })),
    radiation_cumulative_msv: log.cumulativeDoseMsv,
  };
}

export interface MockContext {
  astronautId: string;
  day: number;
  seq: number;
  envId?: EnvironmentId;
  overrides?: Overrides;
  whatIfs?: WhatIfId[];
  jitter?: boolean;
}

const jit = (v: number, amp: number, d = 0) => Math.round((v + (Math.random() * 2 - 1) * amp) * 10 ** d) / 10 ** d;

export function buildMockTick(ctx: MockContext): BrainTick {
  const a = astronautById(ctx.astronautId);
  let log = ctx.envId ? effectiveLog(ctx.astronautId, ctx.day, ctx.envId, ctx.overrides, ctx.whatIfs) : getLog(ctx.astronautId, ctx.day);
  if (ctx.jitter) {
    log = { ...log, hr: jit(log.hr, 1.2), coreTemp: jit(log.coreTemp, 0.05, 1), respRate: jit(log.respRate, 0.6),
      radiationMsvDay: jit(log.radiationMsvDay, log.radiationMsvDay * 0.04, 2), glucose: jit(log.glucose, 1) };
  }
  const hist = ctx.envId ? effectiveHistory(ctx.astronautId, ctx.day, ctx.envId) : getHistory(ctx.astronautId, ctx.day);
  return tickFromTriage(triage(a, log, hist), log, ctx.seq, ctx.envId);
}

/** Scripted replay for the standalone mock server: green → yellow → red (SpO₂ 98 → 93 → 89, HR rising, radiation spike). */
const KEYS = [
  { t: 0, spo2: 98, hr: 62, resp: 14, temp: 36.9, rad: 0.5 },
  { t: 30, spo2: 97, hr: 64, resp: 14, temp: 36.9, rad: 0.5 },
  { t: 45, spo2: 93, hr: 69, resp: 17, temp: 37.0, rad: 0.6 },
  { t: 70, spo2: 92, hr: 71, resp: 17, temp: 37.1, rad: 1.6 },
  { t: 85, spo2: 89, hr: 88, resp: 22, temp: 37.3, rad: 6.0 },
  { t: 110, spo2: 89, hr: 90, resp: 22, temp: 37.3, rad: 6.0 },
];

export function scenarioTick(i: number): BrainTick {
  const t = i % 120;
  let k = KEYS.length - 2;
  for (let j = 0; j < KEYS.length - 1; j++) if (t >= KEYS[j].t && t < KEYS[j + 1].t) { k = j; break; }
  const A = KEYS[k];
  const B = KEYS[k + 1];
  const p = Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t)));
  const lerp = (x: number, y: number) => x + (y - x) * p;
  const base = getLog('astro-01', 30);
  const log: DailyTelemetryLog = {
    ...base, pain: {}, symptoms: [], events: [],
    spo2: Math.round(lerp(A.spo2, B.spo2)), hr: Math.round(lerp(A.hr, B.hr)), respRate: Math.round(lerp(A.resp, B.resp)),
    coreTemp: Math.round(lerp(A.temp, B.temp) * 10) / 10, radiationMsvDay: Math.round(lerp(A.rad, B.rad) * 100) / 100,
  };
  return tickFromTriage(triage(astronautById('astro-01'), log, getHistory('astro-01', 30)), log, i, 'iss');
}

export const levelRank = (l: BrainTick['alertLevel']) => STATUS_RANK[l];
