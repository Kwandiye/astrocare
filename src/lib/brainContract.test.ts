import { describe, expect, it } from 'vitest';
import { parseTick } from '@/types/brain';

const baseTick = {
  timestamp: '2026-11-14T10:00:00Z',
  alertLevel: 'yellow',
  activeFlags: [{ type: 'radiation', severity: 'warning', reason: 'Dose elevated', triggeredValue: 140, metric: 'radiation_dose_rate', zone: 'skin_immune' }],
  rawVitals: { hr: 72, spo2: 98, temp_c: 36.8, resp_rate: 14, radiation_dose_rate: 140, bp_sys: 120, bp_dia: 80 },
  doctorRecommendation: 'Move to shielding. Re-check the dose. Contact ground medical if it persists.',
  astronautId: 'ASTRO-01',
  missionDay: 52,
  doctorSource: 'fallback',
  bodySystems: { heart: 'green', lungs: 'green', skin_immune: 'yellow' },
  flagDetails: [{ code: 'RADIATION_ELEVATED', severity: 'yellow', message: 'Dose elevated', value: 140, threshold: 100, evidenceRef: 'docs/EVIDENCE.md' }],
  likelyConditions: [{ code: 'ACUTE_RADIATION_SYNDROME', label: 'Radiation sickness', confidence: 0.3, drivers: ['RADIATION_ELEVATED'], evidenceRef: 'docs/EVIDENCE.md', resources: [], onboardCapability: { status: 'unknown', missing: [] } }],
  plans: { exercise: { status: 'reduced', reason: 'Reduce workload', sessions: [{ type: 'resistive', minutes: 75, note: 'Reassess.' }], targetMinutes: 150 }, nutrition: { status: 'normal', targetKcal: 2800, hydration: 'normal hydration' } },
  bodyTrajectory: { missionDay: 52, exerciseAdherence: 0.8, adherenceSource: 'sample', populationModel: true, disclaimer: 'Population expectation; not a measurement.', evidenceRef: 'docs/EVIDENCE_TRAJECTORY.md', parameters: [{ code: 'bone_bmd_hip_pct', label: 'Hip BMD', unit: '%', missionDay: 52, expected: -1.23, lower: -1.54, upper: -0.92, adherenceUsed: 0.8, extrapolated: false, evidenceRef: 'row 1b', status: 'VERIFIED' }] },
};

describe('brain contract', () => {
  it('keeps additive brain fields after parsing', () => {
    const tick = parseTick(baseTick);
    expect(tick?.bodySystems?.skin_immune).toBe('yellow');
    expect(tick?.plans?.exercise.status).toBe('reduced');
    expect(tick?.bodyTrajectory?.parameters[0].expected).toBe(-1.23);
    expect(tick?.likelyConditions?.[0].resources).toEqual([]);
  });

  it('rejects an invalid zone or severity', () => {
    expect(parseTick({ ...baseTick, bodySystems: { heart: 'purple' } })).toBeNull();
    expect(parseTick({ ...baseTick, activeFlags: [{ ...baseTick.activeFlags[0], severity: 'critical' }] })).not.toBeNull();
  });

  it('preserves the frontend fallback for a minimal tick', () => {
    const tick = parseTick({
      timestamp: baseTick.timestamp,
      alertLevel: 'green',
      activeFlags: [],
      rawVitals: { hr: 70, spo2: 99, temp_c: 36.8, resp_rate: 14, radiation_dose_rate: 20 },
      doctorRecommendation: 'All monitored parameters nominal.',
    });
    expect(tick?.alertLevel).toBe('green');
    expect(tick?.bodyTrajectory).toBeUndefined();
  });
});
