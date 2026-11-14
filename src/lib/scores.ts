import type { Astronaut, DailyTelemetryLog, TriageResult, TriageStatus } from '@/types/health';
import { phaseBaselines } from './triageEngine';

export interface Contributor { label: string; impact: number }
export interface Score {
  id: 'recovery' | 'strain' | 'stress' | 'sleep' | 'cognitive' | 'eva' | 'bone';
  label: string;
  value: number;
  max: number;
  unit: string;
  display: string;
  status: Exclude<TriageStatus, 'stale'>;
  contributors: Contributor[];
  advice: string[];
  formula: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r = (v: number) => Math.round(v);
const top3 = (c: Contributor[]) => [...c].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 3).map((x) => ({ ...x, impact: r(x.impact) }));

function z(a: Astronaut, l: DailyTelemetryLog, key: 'hr' | 'hrvRmssd') {
  const b = phaseBaselines(a, l)[key]!;
  return (l[key] - b.mean) / b.sd;
}

/** Recovery 0–100 %: HRV vs baseline, resting HR vs baseline, sleep, SpO₂, ppCO₂ > 3.0 and radiation penalties. */
export function recovery(a: Astronaut, l: DailyTelemetryLog): Score {
  const c: Contributor[] = [
    { label: `HRV ${l.hrvRmssd} ms vs baseline`, impact: clamp(z(a, l, 'hrvRmssd') * 12, -35, 12) },
    { label: `Resting HR ${l.hr} bpm vs baseline`, impact: clamp(-z(a, l, 'hr') * 10, -30, 8) },
    { label: `Sleep ${l.sleepHours} h · ${l.sleepEfficiency}% efficient`, impact: clamp(((l.sleepHours - 7) / 7) * 50, -25, 4) + clamp((l.sleepEfficiency - 91.8) * 2, -20, 5) },
    { label: `SpO₂ ${l.spo2}%`, impact: l.spo2 < 96 ? -(96 - l.spo2) * 5 : 0 },
    { label: `Cabin CO₂ ${l.ppCO2} mmHg`, impact: l.ppCO2 > 3 ? -clamp((l.ppCO2 - 3) * 5, 0, 25) : 0 },
    { label: `Radiation ${l.radiationMsvDay} mSv`, impact: l.radiationMsvDay > 1 ? -clamp(l.radiationMsvDay * 2.5, 0, 15) : 0 },
  ];
  const value = r(clamp(78 + c.reduce((s, x) => s + x.impact, 0), 0, 100));
  const status = value >= 67 ? 'green' : value >= 34 ? 'yellow' : 'red';
  return {
    id: 'recovery', label: 'Recovery', value, max: 100, unit: '%', display: `${value}%`, status, contributors: top3(c),
    advice: status === 'green' ? ['Body is ready for a normal or hard training day.'] :
      ['Keep exercise light (zone 2) today.', 'Prioritise 7+ h sleep tonight.', l.ppCO2 > 3 ? 'Spend rest time in the best-ventilated module.' : 'Hydrate 2.5 L+ today.'],
    formula: 'Recovery = 78 + Σ contributors (HRV z×12, −RHR z×10, sleep, SpO₂, CO₂, radiation), clamped 0–100',
  };
}

/** Strain 0–21 (log-scaled cardiovascular load). */
export function strain(a: Astronaut, l: DailyTelemetryLog): Score {
  const hrLift = Math.max(0, (l.hr - (phaseBaselines(a, l).hr?.mean ?? 62)) / 60);
  const eva = l.events.includes('eva') ? 220 : 0;
  const load = l.exerciseMinutes * (1 + hrLift) + l.resistanceMinutes * 0.5 + eva;
  const value = Math.round(21 * (1 - Math.exp(-load / 260)) * 10) / 10;
  const status = value > 18 ? 'yellow' : 'green';
  return {
    id: 'strain', label: 'Strain', value, max: 21, unit: '', display: value.toFixed(1), status,
    contributors: top3([
      { label: `Exercise ${l.exerciseMinutes} min`, impact: l.exerciseMinutes / 10 },
      { label: `Resistance ${l.resistanceMinutes} min`, impact: l.resistanceMinutes / 20 },
      { label: 'EVA', impact: eva / 20 },
    ]).filter((x) => x.impact !== 0),
    advice: value > 18 ? ['Very high load — schedule a recovery day.'] : value < 8 ? ['Load is low — complete ARED + treadmill to protect bone and muscle.'] : ['Load is on target for countermeasures.'],
    formula: 'Strain = 21 × (1 − e^(−load/260)), load = exercise min × (1 + HR lift) + 0.5 × resistance + EVA',
  };
}

/** Stress 0–100: HRV drop + HR elevation without activity + self-reported VAS. */
export function stress(a: Astronaut, l: DailyTelemetryLog): Score {
  const c: Contributor[] = [
    { label: 'HRV below baseline', impact: Math.max(0, -z(a, l, 'hrvRmssd')) * 10 },
    { label: 'Resting HR above baseline', impact: Math.max(0, z(a, l, 'hr')) * 7 },
    { label: `Self-reported stress ${l.stressVas}/100`, impact: (l.stressVas - 25) * 0.5 },
    { label: `Mood ${l.mood}/5`, impact: (4 - l.mood) * 5 },
  ];
  const value = r(clamp(22 + c.reduce((s, x) => s + x.impact, 0), 0, 100));
  const status = value >= 70 ? 'red' : value >= 45 ? 'yellow' : 'green';
  return {
    id: 'stress', label: 'Stress', value, max: 100, unit: '', display: `${value}`, status, contributors: top3(c),
    advice: status === 'green' ? ['Stress is in your normal range.'] : ['5 min paced breathing (6/min).', 'Call family / private psychological conference.', 'Take a window break (Cupola).'],
    formula: 'Stress = 22 + 10×(−HRV z)⁺ + 7×(HR z)⁺ + 0.5×(VAS−25) + 5×(4−mood)',
  };
}

/** Sleep 0–100: duration vs need (60 %) + efficiency (40 %) − circadian shift penalty. */
export function sleep(_a: Astronaut, l: DailyTelemetryLog): Score {
  const dur = clamp(l.sleepHours / 7, 0, 1) * 100;
  const eff = clamp((l.sleepEfficiency - 78) / (95 - 78), 0, 1) * 100;
  const shift = l.events.includes('circadian_shift') ? -10 : 0;
  const value = r(clamp(0.6 * dur + 0.4 * eff + shift, 0, 100));
  const status = value >= 70 ? 'green' : value >= 50 ? 'yellow' : 'red';
  return {
    id: 'sleep', label: 'Sleep', value, max: 100, unit: '%', display: `${value}%`, status,
    contributors: top3([
      { label: `Duration ${l.sleepHours} h (need 7 h)`, impact: (dur - 100) * 0.6 },
      { label: `Efficiency ${l.sleepEfficiency}%`, impact: (eff - 80) * 0.4 },
      { label: 'Circadian "slam shift"', impact: shift },
    ]).filter((x) => x.impact !== 0),
    advice: status === 'green' ? ['Keep the same sleep window.'] : ['Dim lights 1 h before sleep; eye mask + earplugs.', 'No caffeine after 14:00 GMT.', 'Check crew-quarters ventilation (CO₂ pockets).'],
    formula: 'Sleep = 0.6 × min(1, h/7)×100 + 0.4 × efficiency score − 10 if circadian shift',
  };
}

export function cognitive(_a: Astronaut, l: DailyTelemetryLog): Score {
  const value = r(clamp(100 - Math.max(0, l.pvtWorst10Ms - 350) / 3, 0, 100));
  const status = value >= 60 ? 'green' : value >= 40 ? 'yellow' : 'red';
  return {
    id: 'cognitive', label: 'Cognitive readiness', value, max: 100, unit: '', display: `${value}`, status,
    contributors: [{ label: `PVT-B worst 10%: ${l.pvtWorst10Ms} ms`, impact: -Math.max(0, l.pvtWorst10Ms - 350) / 3 }],
    advice: status === 'green' ? ['Cleared for complex tasks.'] : ['Use two-person checks on critical procedures.', 'Rest, then repeat PVT.'],
    formula: 'Cognitive = 100 − (PVT worst-10% − 350 ms)/3',
  };
}

export function evaReadiness(t: TriageResult, rec: Score, l: DailyTelemetryLog): Score {
  const critical = ['heart', 'lungs', 'brain', 'inner_ear', 'skin_immune', 'eyes'] as const;
  const reds = critical.filter((z) => t.zones[z].status === 'red');
  const yellows = critical.filter((z) => t.zones[z].status === 'yellow');
  const noGo = reds.length > 0 || l.radiationMsvDay > 1 || rec.value < 34;
  const status = noGo ? 'red' : yellows.length ? 'yellow' : 'green';
  const display = noGo ? 'NO-GO' : yellows.length ? 'CAUTION' : 'GO';
  const contributors: Contributor[] = [
    ...reds.map((z) => ({ label: `${z} is RED`, impact: -40 })),
    ...yellows.map((z) => ({ label: `${z} is YELLOW`, impact: -15 })),
    ...(l.radiationMsvDay > 1 ? [{ label: 'Space-weather / radiation alert', impact: -40 }] : []),
  ].slice(0, 3);
  return {
    id: 'eva', label: 'EVA readiness', value: noGo ? 0 : yellows.length ? 50 : 100, max: 100, unit: '', display, status,
    contributors, advice: noGo ? ['EVA not recommended today — reschedule.'] : ['Pre-breathe protocol as planned.'],
    formula: 'NO-GO if any critical zone RED, radiation > 1 mSv/day, or Recovery < 34 %',
  };
}

export function boneHealth(l: DailyTelemetryLog): Score {
  const rate = l.bmdLossRatePctMonth;
  const status = rate > 1.5 ? 'red' : rate > 1.0 ? 'yellow' : 'green';
  return {
    id: 'bone', label: 'Bone health', value: l.bmdLossCumulativePct, max: 10, unit: '%', display: `−${l.bmdLossCumulativePct.toFixed(1)}%`, status,
    contributors: [{ label: `Loss rate ${rate} %/month (expected 0.5–1.0 with ARED)`, impact: -rate * 10 }],
    advice: ['Full ARED squat/deadlift session.', 'Calcium 1000 mg + vitamin D 800 IU.', 'Drink ≥ 2.5 L to limit stone risk.'],
    formula: 'Estimated BMD loss since launch = rate (%/month) × mission days / 30',
  };
}

export function allScores(a: Astronaut, l: DailyTelemetryLog, t: TriageResult): Score[] {
  const rec = recovery(a, l);
  return [rec, strain(a, l), stress(a, l), sleep(a, l), cognitive(a, l), evaReadiness(t, rec, l), boneHealth(l)];
}
