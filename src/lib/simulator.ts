import type { DailyTelemetryLog, MissionEventType } from '@/types/health';
import { getLog, getHistory } from '@/data/generator';
import { envById, type EnvironmentId } from './environments';

/** What-If scenarios: patches applied on top of the selected day. */
export type WhatIfId = 'spe' | 'cdra' | 'circadian' | 'skipped_exercise';

export const WHAT_IFS: { id: WhatIfId; label: string; description: string; patch: (l: DailyTelemetryLog) => Partial<DailyTelemetryLog>; event: MissionEventType }[] = [
  { id: 'spe', label: 'Solar particle event', event: 'spe', description: 'Dose rate jumps ×10; crew must shelter.',
    patch: (l) => ({ radiationMsvDay: Math.round(l.radiationMsvDay * 11 * 100) / 100, coreTemp: l.coreTemp + 0.3 }) },
  { id: 'cdra', label: 'CO₂ scrubber (CDRA) failure', event: 'cdra_failure', description: 'ppCO₂ climbs to 8 mmHg; headaches, slow reactions.',
    patch: (l) => ({ ppCO2: 8.0, pvtWorst10Ms: l.pvtWorst10Ms + 140, sleepEfficiency: l.sleepEfficiency - 6, respRate: l.respRate + 4, hr: l.hr + 8, symptoms: ['headache'] }) },
  { id: 'circadian', label: 'Circadian "slam shift"', event: 'circadian_shift', description: 'Sleep window moved 6 h for a docking.',
    patch: (l) => ({ sleepHours: 4.4, sleepEfficiency: 84, pvtWorst10Ms: l.pvtWorst10Ms + 110, stressVas: l.stressVas + 25, mood: Math.max(1, l.mood - 1) }) },
  { id: 'skipped_exercise', label: 'Skipped exercise ×3 days', event: 'skipped_exercise', description: 'No ARED / treadmill — bone and muscle loss accelerate.',
    patch: (l) => ({ exerciseMinutes: 10, resistanceMinutes: 0, bmdLossRatePctMonth: Math.round((l.bmdLossRatePctMonth + 0.5) * 100) / 100, hrvRmssd: l.hrvRmssd - 4 }) },
];

export type Overrides = Partial<DailyTelemetryLog>;

export function applyEnvironment(l: DailyTelemetryLog, envId: EnvironmentId): DailyTelemetryLog {
  const env = envById(envId);
  if (env.id === 'iss') return { ...l, envRadiationBaseline: 0.55 };
  return {
    ...l,
    radiationMsvDay: Math.round(l.radiationMsvDay * env.radiationMult * 100) / 100,
    cumulativeDoseMsv: Math.round(l.cumulativeDoseMsv * env.radiationMult * 10) / 10,
    bmdLossRatePctMonth: Math.round(l.bmdLossRatePctMonth * env.boneMult * 100) / 100,
    bmdLossCumulativePct: Math.round(l.bmdLossCumulativePct * env.boneMult * 100) / 100,
    envRadiationBaseline: 0.55 * env.radiationMult,
  };
}

export function effectiveLog(astronautId: string, day: number, envId: EnvironmentId, overrides?: Overrides, whatIfs: WhatIfId[] = []): DailyTelemetryLog {
  let l: DailyTelemetryLog = applyEnvironment({ ...getLog(astronautId, day) }, envId);
  for (const id of whatIfs) {
    const w = WHAT_IFS.find((x) => x.id === id);
    if (!w) continue;
    l = { ...l, ...w.patch(l), events: [...l.events, w.event] };
  }
  if (overrides) {
    l = { ...l, ...overrides, pain: { ...l.pain, ...(overrides.pain ?? {}) }, symptoms: [...l.symptoms, ...(overrides.symptoms ?? [])] };
  }
  return l;
}

export function effectiveHistory(astronautId: string, day: number, envId: EnvironmentId, n = 7) {
  return getHistory(astronautId, day, n).map((l) => applyEnvironment(l, envId));
}
