import type { TriageStatus } from '@/types/health';

/**
 * NEWS2-adapted range bands (demo; adapted for healthy astronauts). NEWS2 is a clinical early-warning
 * score — here it only provides visual context. The brain's alertLevel always wins.
 */
export type Band = { from: number; to: number; status: Exclude<TriageStatus, 'stale'> };
export interface RangeDef { min: number; max: number; bands: Band[]; deadBand: number; bad: 'up' | 'down' | 'both' }

const b = (from: number, to: number, status: Band['status']): Band => ({ from, to, status });

export const RANGES: Record<string, RangeDef> = {
  hr: { min: 30, max: 150, deadBand: 0.25, bad: 'both', bands: [b(30, 40, 'red'), b(40, 50, 'yellow'), b(50, 90, 'green'), b(90, 130, 'yellow'), b(130, 150, 'red')] },
  spo2: { min: 85, max: 100, deadBand: 0.1, bad: 'down', bands: [b(85, 90, 'red'), b(90, 94, 'yellow'), b(94, 100, 'green')] },
  resp_rate: { min: 5, max: 30, deadBand: 0.15, bad: 'both', bands: [b(5, 8.5, 'red'), b(8.5, 11.5, 'yellow'), b(11.5, 20.5, 'green'), b(20.5, 24.5, 'yellow'), b(24.5, 30, 'red')] },
  temp_c: { min: 34, max: 40, deadBand: 0.01, bad: 'both', bands: [b(34, 35.05, 'red'), b(35.05, 36.05, 'yellow'), b(36.05, 38.05, 'green'), b(38.05, 39.05, 'yellow'), b(39.05, 40, 'red')] },
  bp_sys: { min: 80, max: 230, deadBand: 0.3, bad: 'both', bands: [b(80, 90, 'red'), b(90, 110, 'yellow'), b(110, 140, 'green'), b(140, 180, 'yellow'), b(180, 230, 'red')] },
  glucose_mgdl: { min: 40, max: 300, deadBand: 0.4, bad: 'both', bands: [b(40, 54, 'red'), b(54, 70, 'yellow'), b(70, 180, 'green'), b(180, 250, 'yellow'), b(250, 300, 'red')] },
  sleepHours: { min: 0, max: 10, deadBand: 0.1, bad: 'down', bands: [b(0, 4, 'red'), b(4, 6, 'yellow'), b(6, 10, 'green')] },
  mood: { min: 1, max: 5, deadBand: 0.1, bad: 'down', bands: [b(1, 1.5, 'red'), b(1.5, 2.5, 'yellow'), b(2.5, 5, 'green')] },
  radiation: { min: 0, max: 10, deadBand: 0.02, bad: 'up', bands: [b(0, 1, 'green'), b(1, 5, 'yellow'), b(5, 10, 'red')] },
};

export function bandStatus(def: RangeDef, v: number): Band['status'] {
  const band = def.bands.find((x) => v >= x.from && v < x.to);
  if (band) return band.status;
  return v < def.min ? def.bands[0].status : def.bands[def.bands.length - 1].status;
}
