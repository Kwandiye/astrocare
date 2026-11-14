import type { DailyTelemetryLog, TriageStatus } from '@/types/health';
import type { EnvironmentProfile } from '@/lib/environments';
import { metricDef, evaluateMetric } from '@/lib/triageEngine';
import { ASTRONAUTS } from '@/data/astronauts';

/**
 * Spacecraft environment readings. CO₂ and radiation come from the existing mission data and are judged by
 * the triage engine's configured limits. O₂, pressure, temperature and humidity are NOT in the dataset:
 * they are deterministic DEMO values, shown against published ISS operating ranges for context only and
 * never raise alerts.
 */
export interface CabinReading {
  id: string; label: string; value: string; unit: string; status: TriageStatus | 'info';
  note: string; demo: boolean; term?: string;
}

function rand(seed: number) { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

export function cabinReadings(log: DailyTelemetryLog, env: EnvironmentProfile, radiationNow: number): CabinReading[] {
  const a = ASTRONAUTS[0];
  const co2 = evaluateMetric(metricDef('ppCO2')!, a, log, []);
  const rad = evaluateMetric(metricDef('radiationMsvDay')!, a, { ...log, radiationMsvDay: Math.round(radiationNow * 100) / 100 }, []);
  const s = log.missionDay * 7 + env.id.length;
  const o2 = 21 + (rand(s) - 0.5) * 0.6;
  const kpa = 101.3 + (rand(s + 1) - 0.5) * 0.6;
  const tc = 22.4 + (rand(s + 2) - 0.5) * 1.6;
  const rh = 45 + (rand(s + 3) - 0.5) * 12;
  return [
    { id: 'co2', label: 'Cabin CO₂', value: log.ppCO2.toFixed(1), unit: 'mmHg', status: co2.status, term: 'ppCO₂', demo: false,
      note: co2.reason ?? 'Below the 3.0 mmHg crew limit' },
    { id: 'o2', label: 'Cabin O₂', value: o2.toFixed(1), unit: '%', status: 'info', demo: true, note: 'ISS ops range ≈ 19.5–23.5 %' },
    { id: 'press', label: 'Cabin pressure', value: kpa.toFixed(1), unit: 'kPa', status: 'info', demo: true, note: 'Sea-level equivalent ≈ 101.3 kPa' },
    { id: 'temp', label: 'Temperature', value: tc.toFixed(1), unit: '°C', status: 'info', demo: true, note: 'ISS ops range ≈ 18–27 °C' },
    { id: 'rh', label: 'Humidity', value: Math.round(rh).toString(), unit: '%', status: 'info', demo: true, note: 'ISS ops range ≈ 25–75 %' },
    { id: 'rad', label: 'Radiation', value: radiationNow.toFixed(2), unit: 'mSv/day', status: rad.status, demo: false,
      note: rad.reason ?? `${env.short} background ≈ ${(log.envRadiationBaseline ?? 0.55).toFixed(2)} mSv/day` },
  ];
}
