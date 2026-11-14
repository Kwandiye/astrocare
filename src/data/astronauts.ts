import type { Astronaut, Baseline, MetricId } from '@/types/health';

/** Phase-2 (long-duration) personal baselines. Synthetic demo values, not clinical. */
type BaseProfile = Partial<Record<MetricId, Baseline>>;

const commonP2: BaseProfile = {
  hr: { mean: 62, sd: 4 },
  hrvRmssd: { mean: 48, sd: 6 },
  sbp: { mean: 116, sd: 7 },
  dbp: { mean: 72, sd: 5 },
  spo2: { mean: 98, sd: 1 },
  respRate: { mean: 14, sd: 1.5 },
  sleepHours: { mean: 6.4, sd: 0.5 },
  sleepEfficiency: { mean: 91.8, sd: 2 },
  pvtWorst10Ms: { mean: 420, sd: 45 },
  stressVas: { mean: 25, sd: 10 },
  mood: { mean: 4, sd: 0.8 }, // integer 1–5 scale: one step (4→3) stays green
  iop: { mean: 15, sd: 1.5 },
  kcalIntake: { mean: 2700, sd: 250 },
  proteinG: { mean: 105, sd: 15 },
  bodyMassKg: { mean: 75, sd: 1.2 },
  glucose: { mean: 92, sd: 8 },
  hydrationMl: { mean: 2500, sd: 300 },
  skinTemp: { mean: 33.6, sd: 0.5 },
  coreTemp: { mean: 37.0, sd: 0.25 },
};

/** Phase 1 (adaptation, days 0–14): fluid shift → more variable vitals, slightly lower HR/DBP. */
function phase1From(p2: BaseProfile): BaseProfile {
  const out: BaseProfile = {};
  for (const [k, b] of Object.entries(p2) as [MetricId, Baseline][]) {
    out[k] = { mean: b.mean, sd: b.sd * 1.3 };
  }
  out.hr = { mean: (p2.hr?.mean ?? 62) + 3, sd: 5 };
  out.dbp = { mean: (p2.dbp?.mean ?? 72) - 2, sd: 6 };
  out.sleepHours = { mean: 6.0, sd: 0.7 };
  return out;
}

function profile(over: BaseProfile): Astronaut['baselines'] {
  const p2 = { ...commonP2, ...over };
  return { phase1_adaptation: phase1From(p2), phase2_longduration: p2 };
}

export const ASTRONAUTS: Astronaut[] = [
  {
    id: 'astro-01', name: 'Cmdr. A. Reyes', role: 'Commander', age: 44, initials: 'AR', color: '#38BDF8',
    story: 'Day 50–53: CO2 scrubber (CDRA) failure + solar particle event → YELLOW on day 52, RED on day 53.',
    baselines: profile({}),
  },
  {
    id: 'astro-02', name: 'Dr. K. Tanaka', role: 'Flight Engineer / CMO', age: 39, initials: 'KT', color: '#A78BFA',
    story: 'Slow SANS progression: intraocular pressure rising from day 60, optic disc edema from day 120.',
    baselines: profile({ hr: { mean: 58, sd: 4 }, hrvRmssd: { mean: 62, sd: 7 }, bodyMassKg: { mean: 64, sd: 1 }, kcalIntake: { mean: 2300, sd: 220 }, proteinG: { mean: 90, sd: 12 } }),
  },
  {
    id: 'astro-03', name: 'M. Okafor', role: 'Mission Specialist', age: 36, initials: 'MO', color: '#F472B6',
    story: 'Accelerated bone loss in hips/spine (−1.3 %/month) despite exercise; kidney-stone risk when hydration drops.',
    baselines: profile({ hr: { mean: 66, sd: 4 }, bodyMassKg: { mean: 82, sd: 1.3 }, kcalIntake: { mean: 2950, sd: 260 } }),
  },
  {
    id: 'astro-04', name: 'L. Novak', role: 'Payload Specialist', age: 41, initials: 'LN', color: '#FBBF24',
    story: 'Mostly nominal. Circadian "slam shift" around day 90 degrades sleep for a few days.',
    baselines: profile({ hr: { mean: 60, sd: 4 }, sleepHours: { mean: 6.6, sd: 0.5 } }),
  },
];

export const astronautById = (id: string): Astronaut => ASTRONAUTS.find((a) => a.id === id) ?? ASTRONAUTS[0];

export const MISSION_DAYS = 180;
export const PHASE1_END_DAY = 14;
export const CAREER_DOSE_LIMIT_MSV = 600; // NASA-STD-3001 career effective-dose limit
