import type { DailyTelemetryLog, MissionPhase, MissionEventType, Astronaut } from '@/types/health';
import { ASTRONAUTS, MISSION_DAYS, PHASE1_END_DAY, astronautById } from './astronauts';

/**
 * Deterministic synthetic telemetry: 4 astronauts × 180 mission days.
 * Each (astronaut, day) has its own seed, so any day can be generated independently and offline.
 * Normal-day noise is bounded to ±1.4σ, so nominal days stay GREEN and the scripted stories stand out.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

export function phaseForDay(day: number): MissionPhase {
  if (day < 0) return 'preflight';
  if (day > MISSION_DAYS) return 'postflight';
  return day <= PHASE1_END_DAY ? 'phase1_adaptation' : 'phase2_longduration';
}

function baseRadiation(rng: () => number) {
  return 0.45 + rng() * 0.2; // ISS-like 0.45–0.65 mSv/day
}

/** Bone-loss rate (%BMD per month in weight-bearing bones) per astronaut. */
const BMD_RATE: Record<string, number> = { 'astro-01': 0.7, 'astro-02': 0.6, 'astro-03': 1.3, 'astro-04': 0.8 };

function rawDay(a: Astronaut, day: number): DailyTelemetryLog {
  const rng = mulberry32(hashStr(`${a.id}:${day}`));
  const gauss = () => {
    const u = Math.max(1e-9, rng());
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const phase = phaseForDay(day);
  const bl = phase === 'phase1_adaptation' ? a.baselines.phase1_adaptation : a.baselines.phase2_longduration;
  const n = (key: keyof typeof bl, scale = 0.55) => {
    const b = bl[key]!;
    return b.mean + clamp(gauss() * scale, -1.4, 1.4) * b.sd;
  };
  const rate = BMD_RATE[a.id] ?? 0.8;

  return {
    astronautId: a.id,
    missionDay: day,
    phase,
    hr: round(n('hr'), 0),
    hrvRmssd: round(n('hrvRmssd'), 0),
    sbp: round(n('sbp'), 0),
    dbp: round(n('dbp'), 0),
    spo2: round(clamp(n('spo2'), 95, 100), 0),
    respRate: round(n('respRate'), 0),
    skinTemp: round(n('skinTemp'), 1),
    coreTemp: round(n('coreTemp'), 1),
    glucose: round(n('glucose'), 0),
    sleepHours: round(n('sleepHours'), 1),
    sleepEfficiency: round(n('sleepEfficiency'), 1),
    pvtWorst10Ms: round(n('pvtWorst10Ms'), 0),
    stressVas: round(clamp(n('stressVas'), 0, 100), 0),
    mood: clamp(Math.round(n('mood', 0.4)), 1, 5),
    ppCO2: round(2.0 + rng() * 0.45, 2),
    radiationMsvDay: round(baseRadiation(rng), 2),
    cumulativeDoseMsv: 0, // filled in by cumulative pass
    exerciseMinutes: round(110 + rng() * 35, 0),
    resistanceMinutes: round(40 + rng() * 15, 0),
    iop: round(n('iop'), 1),
    opticDiscEdema: false,
    hydrationMl: round(n('hydrationMl'), -1),
    kcalIntake: round(n('kcalIntake'), -1),
    proteinG: round(n('proteinG'), 0),
    bodyMassKg: round(n('bodyMassKg'), 1),
    motionSickness: 0,
    bmdLossRatePctMonth: round(rate + (rng() - 0.5) * 0.06, 2),
    bmdLossCumulativePct: round((rate * Math.max(0, day)) / 30, 2),
    pain: {},
    symptoms: [],
    events: [],
    inputSource: 'wearable',
  };
}

function applyStory(log: DailyTelemetryLog): DailyTelemetryLog {
  const d = log.missionDay;
  const ev = (e: MissionEventType) => { if (!log.events.includes(e)) log.events.push(e); };

  if (log.astronautId === 'astro-01') {
    // Adaptation: motion sickness first days, headaches from fluid shift.
    if (d >= 1 && d <= 3) { log.motionSickness = [5, 3, 1][d - 1]; log.symptoms.push('nausea'); }
    if (d >= 1 && d <= 6) log.symptoms.push('headache (fluid shift)');
    if (d >= 1 && d <= 14) log.hr = Math.round(70 - (d / 14) * 5 + (log.hr - 65) * 0.3);
    // Day 45 EVA: strain up.
    if (d === 45) { ev('eva'); log.exerciseMinutes = 400; log.hr = 66; log.hrvRmssd = 42; }
    if (d === 46) { log.hrvRmssd = 43; log.sleepHours = 7.2; }
    // Days 50–54: CO2 scrubber failure, then a solar particle event (52–53).
    if (d >= 50 && d <= 54) ev('cdra_failure');
    const story: Record<number, Partial<DailyTelemetryLog>> = {
      50: { ppCO2: 3.4, sleepEfficiency: 90.4, pvtWorst10Ms: 455, hr: 63 },
      51: { ppCO2: 3.8, sleepEfficiency: 89.6, pvtWorst10Ms: 470, hr: 64, hrvRmssd: 45, symptoms: ['mild headache'] },
      52: {
        ppCO2: 4.2, radiationMsvDay: 1.6, hr: 67, hrvRmssd: 40, sleepHours: 5.6, sleepEfficiency: 87.5,
        pvtWorst10Ms: 515, stressVas: 50, mood: 3, sbp: 120, dbp: 75, spo2: 97, respRate: 15, coreTemp: 37.1,
        symptoms: ['headache', 'difficulty concentrating'],
      },
      53: {
        ppCO2: 7.8, radiationMsvDay: 6.2, hr: 84, hrvRmssd: 30, sleepHours: 4.9, sleepEfficiency: 81,
        pvtWorst10Ms: 620, stressVas: 75, mood: 2, sbp: 128, dbp: 82, spo2: 95, respRate: 19, coreTemp: 37.4, skinTemp: 34.2,
        symptoms: ['severe headache', 'dizziness', 'shortness of breath'],
      },
      54: { ppCO2: 3.2, radiationMsvDay: 0.9, hr: 70, hrvRmssd: 41, sleepEfficiency: 88.4, pvtWorst10Ms: 490, stressVas: 40, symptoms: ['fatigue'] },
    };
    if (story[d]) Object.assign(log, story[d]);
    if (d === 52 || d === 53) ev('spe');
  }

  if (log.astronautId === 'astro-02') {
    if (d >= 60) log.iop = Math.round((15 + (d - 60) * 0.07 + (log.iop - 15) * 0.3) * 10) / 10;
    if (d >= 120) { log.opticDiscEdema = true; log.symptoms.push('blurred near vision'); }
    if (d % 7 === 0 && d >= 56) ev('sans_exam');
  }

  if (log.astronautId === 'astro-03') {
    if (d % 23 === 0 && d > 0) { ev('skipped_exercise'); log.exerciseMinutes = 25; log.resistanceMinutes = 0; }
    if (d >= 95 && d <= 99) { log.hydrationMl = 1700; log.symptoms.push('flank discomfort'); }
  }

  if (log.astronautId === 'astro-04') {
    if (d >= 90 && d <= 93) {
      ev('circadian_shift');
      log.sleepHours = [4.8, 5.2, 5.6, 6.0][d - 90];
      log.sleepEfficiency = [85.5, 87, 88.6, 90.2][d - 90];
      log.pvtWorst10Ms = [530, 505, 470, 440][d - 90];
    }
  }
  return log;
}

const cache = new Map<string, DailyTelemetryLog[]>();

/** Full mission series for one astronaut (days 0..180), cached. */
export function getMissionSeries(astronautId: string): DailyTelemetryLog[] {
  const hit = cache.get(astronautId);
  if (hit) return hit;
  const a = astronautById(astronautId);
  let cum = 0;
  const series: DailyTelemetryLog[] = [];
  for (let d = 0; d <= MISSION_DAYS; d++) {
    const log = applyStory(rawDay(a, d));
    cum += log.radiationMsvDay;
    log.cumulativeDoseMsv = Math.round(cum * 10) / 10;
    series.push(log);
  }
  cache.set(astronautId, series);
  return series;
}

export function getLog(astronautId: string, day: number): DailyTelemetryLog {
  const s = getMissionSeries(astronautId);
  return s[clamp(Math.round(day), 0, s.length - 1)];
}

/** Up to `n` logs before `day` (oldest first). */
export function getHistory(astronautId: string, day: number, n = 7): DailyTelemetryLog[] {
  const s = getMissionSeries(astronautId);
  return s.slice(Math.max(0, day - n), Math.max(0, day));
}

export const allAstronautIds = () => ASTRONAUTS.map((a) => a.id);
