import { describe, it, expect } from 'vitest';
import { triage, computeMFI, zStatus } from './triageEngine';
import { getLog, getHistory, getMissionSeries } from '@/data/generator';
import { astronautById } from '@/data/astronauts';
import type { DailyTelemetryLog } from '@/types/health';

const a1 = astronautById('astro-01');
const run = (id: string, day: number) => triage(astronautById(id), getLog(id, day), getHistory(id, day));
const withLog = (patch: Partial<DailyTelemetryLog>) => {
  const base = { ...getLog('astro-01', 30), pain: {}, symptoms: [], events: [] };
  return triage(a1, { ...base, ...patch });
};

describe('scripted story astro-01', () => {
  it('day 30 is nominal (GREEN)', () => expect(run('astro-01', 30).overall).toBe('green'));
  it('day 52 → YELLOW', () => {
    const t = run('astro-01', 52);
    expect(t.overall).toBe('yellow');
    expect(t.zones.lungs.status).toBe('yellow');
    expect(t.zones.brain.status).toBe('yellow');
    expect(t.syndromes.map((s) => s.id)).toContain('hypercapnic_fatigue');
  });
  it('day 53 → RED with lungs and heart red', () => {
    const t = run('astro-01', 53);
    expect(t.overall).toBe('red');
    expect(t.zones.lungs.status).toBe('red');
    expect(t.zones.heart.status).toBe('red');
    expect(t.mfi).toBeGreaterThanOrEqual(65);
    expect(t.zones.lungs.protocolId).toBe('respiratory_red');
    expect(t.zones.skin_immune.protocolId).toBe('radiation_red');
  });
});

describe('other crew stories', () => {
  it('astro-02 has optic disc edema → eyes RED from day 120', () => {
    expect(run('astro-02', 119).zones.eyes.status).not.toBe('red');
    expect(run('astro-02', 120).zones.eyes.status).toBe('red');
  });
  it('astro-03 lower skeleton is YELLOW (bone loss 1.3 %/month)', () => {
    expect(run('astro-03', 60).zones.skeleton_lower.status).toBe('yellow');
  });
  it('nominal days are mostly green for the whole crew', () => {
    for (const id of ['astro-01', 'astro-02', 'astro-03', 'astro-04']) {
      if (id === 'astro-03') continue; // bone-loss story is yellow all mission by design
      const lastDay = id === 'astro-02' ? 90 : 180; // SANS story starts showing after day 90
      const days = getMissionSeries(id).filter((l) => l.missionDay > 14 && l.missionDay <= lastDay);
      const greens = days.filter((l) => triage(astronautById(id), l).overall === 'green').length;
      expect(greens / days.length).toBeGreaterThan(0.9);
    }
  });
});

describe('hard triggers', () => {
  const cases: [string, Partial<DailyTelemetryLog>, 'yellow' | 'red', string][] = [
    ['ppCO2 ≥ 7.6', { ppCO2: 7.6 }, 'red', 'lungs'],
    ['ppCO2 > 3.0', { ppCO2: 3.2 }, 'yellow', 'lungs'],
    ['optic disc edema', { opticDiscEdema: true }, 'red', 'eyes'],
    ['SpO2 < 90', { spo2: 89 }, 'red', 'lungs'],
    ['core temp ≥ 39', { coreTemp: 39.1 }, 'red', 'skin_immune'],
    ['core temp < 35', { coreTemp: 34.8 }, 'red', 'skin_immune'],
    ['glucose < 54', { glucose: 50 }, 'red', 'pancreas'],
    ['glucose > 250', { glucose: 260 }, 'red', 'pancreas'],
    ['glucose < 70', { glucose: 65 }, 'red', 'pancreas'], // also z = −3.4 → red by personal baseline
    ['glucose > 180', { glucose: 190 }, 'red', 'pancreas'],
    ['SBP ≥ 180', { sbp: 185 }, 'red', 'heart'],
    ['DBP ≥ 120', { dbp: 121 }, 'red', 'heart'],
    ['SBP < 90', { sbp: 85 }, 'red', 'heart'],
    ['HR > 130', { hr: 135 }, 'red', 'heart'],
    ['HR < 40', { hr: 38 }, 'red', 'heart'],
    ['sleep efficiency < 89.2', { sleepEfficiency: 89.0 }, 'yellow', 'brain'],
    ['PVT > 500', { pvtWorst10Ms: 505 }, 'yellow', 'brain'],
  ];
  for (const [name, patch, expected, zone] of cases) {
    it(name, () => {
      const t = withLog(patch);
      expect(t.zones[zone as keyof typeof t.zones].status).toBe(expected);
    });
  }
  it('glucose 75 mg/dL is not RED (z only)', () => expect(withLog({ glucose: 80 }).zones.pancreas.status).not.toBe('red'));
});

describe('math', () => {
  it('zStatus bands', () => {
    expect(zStatus(1.5, 'both')).toBe('green');
    expect(zStatus(-2, 'both')).toBe('yellow');
    expect(zStatus(3.1, 'up')).toBe('red');
    expect(zStatus(5, 'down')).toBe('green');
  });
  it('MFI day 52 is yellow band, day 53 red band', () => {
    expect(computeMFI(a1, getLog('astro-01', 52))).toBeGreaterThanOrEqual(30);
    expect(computeMFI(a1, getLog('astro-01', 52))).toBeLessThan(65);
    expect(computeMFI(a1, getLog('astro-01', 53))).toBeGreaterThanOrEqual(65);
  });
});
