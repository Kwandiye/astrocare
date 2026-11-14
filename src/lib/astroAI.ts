import type { Astronaut, DailyTelemetryLog, Metric, MetricId, TriageResult, ZoneId } from '@/types/health';
import type { BrainTick } from '@/types/brain';
import type { Score } from '@/lib/scores';
import type { EnvironmentProfile } from '@/lib/environments';
import type { AiRole } from '@/store/useHealthStore';
import { STATUS_RANK } from '@/lib/triageEngine';
import { getProtocol } from '@/lib/protocols';
import { ZONES } from '@/data/zones';

/**
 * Astro AI — an on-board, offline, rule-based companion. It only restates what the triage engine, scores
 * and onboard protocols already say, in plain language. It never diagnoses; anything critical is routed to
 * the onboard protocol and the Crew Medical Officer (CMO).
 */
export interface AiCtx {
  a: Astronaut; log: DailyTelemetryLog; history: DailyTelemetryLog[]; result: TriageResult; scores: Score[];
  tick: BrainTick | null; env: EnvironmentProfile;
}
export interface AiOut { text: string; priority?: 'red' | 'yellow'; steps?: string[]; action?: 'breathing' | 'open-zone'; zone?: ZoneId }

export const ROLE_META: Record<AiRole, { name: string; tagline: string }> = {
  doctor: { name: 'AI Doctor', tagline: 'Vital signs, risks and onboard protocols' },
  fitness: { name: 'Fitness Coach', tagline: 'Exercise, recovery, muscle and bone' },
  nutrition: { name: 'Nutritionist', tagline: 'Hydration, energy and protein' },
  mind: { name: 'Mind & Sleep', tagline: 'Mood, stress, sleep and isolation' },
};

export const QUICK: Record<AiRole, string[]> = {
  doctor: ['How am I doing?', 'What should I do now?', 'Explain my heart rate', 'Is the cabin air OK?'],
  fitness: ['Plan my workout today', 'Am I ready for EVA?', 'How are my bones?'],
  nutrition: ['How is my hydration?', 'What should I eat today?', 'Am I getting enough protein?'],
  mind: ['Start a breathing exercise', 'I feel stressed', 'How did I sleep?', 'I feel isolated'],
};

/** Plain-language "why it matters" per metric (education, not diagnosis). */
const WHY: Partial<Record<MetricId, string>> = {
  hr: 'A resting heart rate away from your normal can reflect fatigue, dehydration, stress or illness.',
  hrvRmssd: 'Lower heart-rate variability usually means the body is less recovered.',
  sbp: 'Blood pressure shifts in microgravity because body fluids move toward the head.',
  dbp: 'Blood pressure shifts in microgravity because body fluids move toward the head.',
  spo2: 'Blood oxygen shows how well the lungs deliver oxygen.',
  respRate: 'Breathing faster than usual can be a response to cabin CO₂, exertion, stress or illness.',
  ppCO2: 'Elevated cabin CO₂ can cause headache, fatigue and slower reactions.',
  sleepHours: 'Short sleep reduces alertness and raises the risk of mistakes.',
  sleepEfficiency: 'Low sleep efficiency means a lot of time awake in the sleep station.',
  pvtWorst10Ms: 'Slower reaction times are an early sign of fatigue.',
  stressVas: 'Sustained stress affects sleep, mood and immunity.',
  mood: 'Mood changes are common on long missions and worth talking about early.',
  iop: 'Eye pressure is tracked because of spaceflight-associated eye changes (SANS).',
  opticDiscEdema: 'Swelling of the optic disc is a sign tracked for SANS and needs specialist review.',
  motionSickness: 'Space motion sickness usually fades after the first days of adaptation.',
  kcalIntake: 'Eating less than you burn leads to weight, muscle and bone loss.',
  proteinG: 'Protein protects muscle mass during long missions.',
  bodyMassKg: 'Losing body mass usually means energy intake is too low.',
  glucose: 'Blood glucose outside the usual range affects energy and concentration.',
  hydrationMl: 'Low fluid intake raises the risk of kidney stones in microgravity.',
  bmdLossRatePctMonth: 'Without loading, weight-bearing bones lose mineral density.',
  bmdUpperRatePctMonth: 'Without loading, bones lose mineral density.',
  exerciseMinutes: 'Daily exercise is the main countermeasure against muscle and bone loss.',
  resistanceMinutes: 'Resistance training keeps muscles and bones loaded.',
  coreTemp: 'Core temperature outside the normal range can indicate infection or heat stress.',
  skinTemp: 'Skin temperature follows cabin temperature and circulation.',
  radiationMsvDay: 'Higher dose rates, such as during a solar particle event, add to long-term risk.',
  cumulativeDoseMsv: 'Total dose is tracked against the career limit.',
};

const ROLE_METRICS: Record<AiRole, MetricId[]> = {
  doctor: ['hr', 'sbp', 'dbp', 'spo2', 'respRate', 'coreTemp', 'glucose', 'ppCO2', 'opticDiscEdema', 'iop', 'motionSickness', 'radiationMsvDay', 'cumulativeDoseMsv', 'hrvRmssd'],
  fitness: ['exerciseMinutes', 'resistanceMinutes', 'bmdLossRatePctMonth', 'bmdUpperRatePctMonth', 'hrvRmssd'],
  nutrition: ['hydrationMl', 'kcalIntake', 'proteinG', 'bodyMassKg', 'glucose'],
  mind: ['mood', 'stressVas', 'sleepHours', 'sleepEfficiency', 'pvtWorst10Ms'],
};

const fmtV = (m: Metric) => `${Number.isInteger(m.value) ? m.value : m.value.toFixed(1)}${!m.unit ? '' : /^[/%]/.test(m.unit) ? m.unit : ` ${m.unit}`}`;
const allMetrics = (r: TriageResult) => {
  const map = new Map<MetricId, Metric & { zone: ZoneId }>();
  for (const z of Object.values(r.zones)) for (const m of z.metrics) if (!map.has(m.id)) map.set(m.id, { ...m, zone: z.zoneId });
  return map;
};
const abnormal = (r: TriageResult, ids?: MetricId[]) => [...allMetrics(r).values()]
  .filter((m) => (m.status === 'yellow' || m.status === 'red') && (!ids || ids.includes(m.id)))
  .sort((x, y) => STATUS_RANK[y.status] - STATUS_RANK[x.status]);
const score = (c: AiCtx, id: Score['id']) => c.scores.find((s) => s.id === id)!;

/** Describe one metric relative to the personal baseline. */
function describe(m: Metric): string {
  let s = `${m.label} is ${fmtV(m)}`;
  if (m.baseline) {
    const pct = m.deviationPct ?? 0;
    s += Math.abs(pct) < 3 ? `, close to your baseline of ${m.baseline.mean}${/^[/%]/.test(m.unit) ? '' : ' '}${m.unit}` : `, ${Math.abs(Math.round(pct))} % ${pct > 0 ? 'above' : 'below'} your baseline of ${m.baseline.mean}${/^[/%]/.test(m.unit) ? '' : ' '}${m.unit}`;
  }
  s += m.status === 'green' ? ' — within your normal range.' : m.status === 'red' ? ' — this is critical.' : ' — this needs attention.';
  return s;
}

function protocolSteps(c: AiCtx, zone: ZoneId): { title: string; steps: string[] } | null {
  const p = getProtocol(c.result.zones[zone].protocolId);
  return p ? { title: p.title, steps: p.steps.map((s) => s.text) } : null;
}

/* ---------------------------------------------------------------- role briefings */

function doctor(c: AiCtx): AiOut[] {
  // vital signs and cabin hazards lead; composite / behavioural metrics follow at equal severity
  const order = (id: MetricId) => (ROLE_METRICS.doctor.includes(id) ? 0 : 1);
  const issues = abnormal(c.result).filter((m) => !ROLE_METRICS.mind.includes(m.id) || m.status === 'red')
    .sort((x, y) => STATUS_RANK[y.status] - STATUS_RANK[x.status] || order(x.id) - order(y.id));
  const out: AiOut[] = [];
  if (issues.length === 0) {
    out.push({ text: `All monitored vital signs are within your personal baseline today. Keep your usual routine; I'll flag anything that changes.` });
    return out;
  }
  const top = issues[0];
  const proto = protocolSteps(c, top.zone);
  out.push({
    priority: top.status === 'red' ? 'red' : 'yellow', zone: top.zone, action: 'open-zone',
    text: `${describe(top)} ${WHY[top.id] ?? ''} ${top.status === 'red'
      ? 'Follow the onboard protocol below now and contact the Crew Medical Officer.'
      : 'I recommend following the onboard protocol below and contacting the Crew Medical Officer if symptoms persist.'}`,
    steps: proto?.steps.slice(0, 5),
  });
  if (c.result.syndromes[0]) {
    const s = c.result.syndromes[0];
    out.push({ text: `These signals fit a known pattern — ${s.name.toLowerCase()}: ${s.explanation} This is a pattern match to guide checks, not a diagnosis.` });
  }
  const rest = issues.slice(1, 4);
  if (rest.length) out.push({ text: `Also watching: ${rest.map((m) => `${m.label} ${fmtV(m)}`).join('; ')}.` });
  if (c.env.delaySec > 60) out.push({ text: `Mission Control is ${Math.round(c.env.delaySec / 60)} minutes away one-way, so act on the onboard protocol first; Earth will confirm later.` });
  return out;
}

function fitness(c: AiCtx): AiOut[] {
  const rec = score(c, 'recovery'), eva = score(c, 'eva'), bone = score(c, 'bone');
  const l = c.log;
  const co2High = l.ppCO2 > 3.0;
  const out: AiOut[] = [];
  out.push({ text: `Recovery is ${rec.display} today and you logged ${l.exerciseMinutes} min of exercise yesterday, including ${l.resistanceMinutes} min of resistance training (targets: ≥ 90 min total, ≥ 20 min resistance).` });
  const plan = rec.status === 'green' && !co2High
    ? ['Warm-up: 5 min easy cycling (CEVIS)', 'Resistance on ARED, 45 min: squats, deadlifts, heel raises, bench press', 'Aerobic, 30 min: treadmill (T2) intervals at moderate effort', 'Cool-down: 10 min mobility and stretching']
    : ['Warm-up: 5 min easy cycling', 'Light ARED, 25 min at reduced load — focus on squats and heel raises to keep bones loaded', 'Aerobic, 20 min at easy effort (you can talk comfortably)', 'Mobility and stretching, 10 min'];
  out.push({
    priority: co2High || rec.status === 'red' ? 'yellow' : undefined,
    text: co2High ? 'Suggested plan — reduced intensity, because cabin CO₂ is above 3.0 mmHg (onboard protocol: avoid heavy exercise until it drops):'
      : rec.status === 'green' ? 'Suggested plan for today — full session:' : 'Suggested plan — a recovery day, because your recovery score is low:',
    steps: plan,
  });
  out.push({ text: `Bone: ${bone.display} estimated loss rate this month (${bone.status === 'green' ? 'on target' : 'above target — keep heavy squats and heel raises in every session'}). EVA readiness: ${eva.display}.` });
  return out;
}

function nutrition(c: AiCtx): AiOut[] {
  const l = c.log;
  const issues = abnormal(c.result, ROLE_METRICS.nutrition);
  const out: AiOut[] = [];
  out.push({ text: `Yesterday: ${l.hydrationMl} mL of fluid, ${l.kcalIntake} kcal and ${l.proteinG} g of protein. Body mass ${l.bodyMassKg.toFixed(1)} kg.` });
  if (issues.length) {
    out.push({ priority: issues[0].status === 'red' ? 'red' : 'yellow', text: `${describe(issues[0])} ${WHY[issues[0].id] ?? ''}` });
  }
  const tips: string[] = [];
  if (l.hydrationMl < 2000) tips.push(`Drink about ${Math.ceil((2000 - l.hydrationMl) / 250) * 250} mL more today — spread it across the day (target ≥ 2.0 L).`);
  else tips.push('Hydration is on target — keep drinking regularly.');
  if (l.proteinG < 70) tips.push('Add a protein-rich item to each meal to reach at least 70 g.');
  if (issues.some((m) => m.id === 'kcalIntake' || m.id === 'bodyMassKg')) tips.push('Energy intake is below your usual — add a snack between meals.');
  tips.push('Include vitamin D and calcium sources as planned in the menu to support bone health.');
  out.push({ text: 'Today:', steps: tips });
  return out;
}

function mind(c: AiCtx): AiOut[] {
  const l = c.log;
  let shortRun = 0;
  for (const h of [...c.history, l].reverse()) { if (h.sleepHours < 6) shortRun++; else break; }
  const out: AiOut[] = [];
  out.push({ text: `You slept ${l.sleepHours.toFixed(1)} h with ${Math.round(l.sleepEfficiency)} % efficiency${shortRun > 1 ? ` — ${shortRun} short nights in a row` : ''}. Mood ${l.mood}/5, stress ${Math.round(l.stressVas)}/100.` });
  const issues = abnormal(c.result, ROLE_METRICS.mind);
  if (issues.length) {
    out.push({ priority: issues[0].status === 'red' ? 'red' : 'yellow', text: `${describe(issues[0])} ${WHY[issues[0].id] ?? ''}` });
  }
  out.push({
    text: 'Things that help:', action: 'breathing',
    steps: [
      'A 2-minute paced-breathing exercise — tap “Start a breathing exercise”.',
      'Keep a fixed sleep window and dim the lights 1 h before sleep.',
      c.env.delaySec > 60 ? 'Record a message for family — with the signal delay, asynchronous messages work best.' : 'Schedule a private call with family or friends.',
      'Tell the CMO if low mood or poor sleep lasts more than a few days — that is what they are there for.',
    ],
  });
  return out;
}

export function briefing(role: AiRole, c: AiCtx): AiOut[] {
  return role === 'doctor' ? doctor(c) : role === 'fitness' ? fitness(c) : role === 'nutrition' ? nutrition(c) : mind(c);
}

/** Highest-priority item per role — used for the Overview "Next actions" card. */
export function topInsights(c: AiCtx): { role: AiRole; out: AiOut }[] {
  return (['doctor', 'fitness', 'nutrition', 'mind'] as AiRole[]).map((role) => {
    const b = briefing(role, c);
    return { role, out: b.find((x) => x.priority) ?? b[0] };
  });
}

/* ---------------------------------------------------------------- natural-language questions */

const LIVE: Partial<Record<MetricId, string>> = { hr: 'hr', spo2: 'spo2', respRate: 'resp_rate', coreTemp: 'temp_c', sbp: 'bp_sys', glucose: 'glucose_mgdl' };
const INTENTS: { re: RegExp; role: AiRole; metric?: MetricId; kind?: 'status' | 'actions' | 'diagnosis' | 'breathing' | 'plan' | 'eva' | 'eat' }[] = [
  { re: /diagnos|do i have|disease|cancer|infection|am i sick/i, role: 'doctor', kind: 'diagnosis' },
  { re: /breath(ing)? (exercise|drill)|calm down|relax|panic/i, role: 'mind', kind: 'breathing' },
  { re: /how am i|overall|status|summary|how('?s| is) my health/i, role: 'doctor', kind: 'status' },
  { re: /what should i do|next step|protocol|what now|help me/i, role: 'doctor', kind: 'actions' },
  { re: /heart|pulse|\bhr\b|bpm/i, role: 'doctor', metric: 'hr' },
  { re: /pressure|\bbp\b/i, role: 'doctor', metric: 'sbp' },
  { re: /oxygen|spo2|spo₂|saturation/i, role: 'doctor', metric: 'spo2' },
  { re: /co2|co₂|cabin|air quality|\bair\b/i, role: 'doctor', metric: 'ppCO2' },
  { re: /respirat|breathing rate|breaths/i, role: 'doctor', metric: 'respRate' },
  { re: /temperat|fever/i, role: 'doctor', metric: 'coreTemp' },
  { re: /glucose|sugar/i, role: 'nutrition', metric: 'glucose' },
  { re: /radiation|dose|solar|sievert|msv/i, role: 'doctor', metric: 'radiationMsvDay' },
  { re: /eye|vision|sans/i, role: 'doctor', metric: 'opticDiscEdema' },
  { re: /eva|spacewalk/i, role: 'fitness', kind: 'eva' },
  { re: /bone|bmd|skeleton/i, role: 'fitness', metric: 'bmdLossRatePctMonth' },
  { re: /workout|exercise|train|ared|treadmill|muscle|gym/i, role: 'fitness', kind: 'plan' },
  { re: /water|hydrat|drink|fluid/i, role: 'nutrition', metric: 'hydrationMl' },
  { re: /protein/i, role: 'nutrition', metric: 'proteinG' },
  { re: /eat|food|meal|calor|nutrition|diet|weight|mass/i, role: 'nutrition', kind: 'eat' },
  { re: /sleep|tired|fatigue|insomnia|rest/i, role: 'mind', metric: 'sleepHours' },
  { re: /stress|anxious|anxiety|worried|overwhelm/i, role: 'mind', metric: 'stressVas' },
  { re: /lonely|isolat|homesick|miss (my )?family|sad|down|mood|depress/i, role: 'mind', metric: 'mood' },
];

export function answer(q: string, current: AiRole, c: AiCtx): { role: AiRole; out: AiOut[] } {
  const hit = INTENTS.find((i) => i.re.test(q));
  if (!hit) {
    return { role: current, out: [{ text: `I can answer questions about your vital signs, cabin air, radiation, sleep, mood, exercise, hydration and nutrition — using today's measurements and the onboard protocols. Try one of the suggestions below.` }] };
  }
  const metrics = allMetrics(c.result);
  if (hit.kind === 'diagnosis') {
    return { role: 'doctor', out: [{ text: `I can't diagnose conditions — I'm a decision-support tool, not a clinician. I can tell you what your measurements show and which onboard protocol applies. For any symptom that worries you, contact the Crew Medical Officer; the flight surgeon on Earth will review it.` }, ...doctor(c).slice(0, 1)] };
  }
  if (hit.kind === 'breathing') return { role: 'mind', out: [{ text: 'Let\'s do 2 minutes of paced breathing: in for 4 seconds, hold 4, out for 6. Follow the circle.', action: 'breathing' }] };
  if (hit.kind === 'status' || hit.kind === 'actions') return { role: 'doctor', out: doctor(c) };
  if (hit.kind === 'plan') return { role: 'fitness', out: fitness(c).slice(1, 2) };
  if (hit.kind === 'eat') return { role: 'nutrition', out: nutrition(c) };
  if (hit.kind === 'eva') { const e = score(c, 'eva'); return { role: 'fitness', out: [{ text: `EVA readiness: ${e.display}. ${e.advice[0] ?? ''}`, priority: e.status === 'red' ? 'red' : e.status === 'yellow' ? 'yellow' : undefined, steps: e.contributors.map((x) => x.label) }] }; }

  const m = hit.metric ? metrics.get(hit.metric) : undefined;
  if (!m) return { role: hit.role, out: briefing(hit.role, c) };
  const liveKey = LIVE[m.id];
  const liveVal = liveKey ? (c.tick?.rawVitals[liveKey] as number | undefined) : undefined;
  const mm = liveVal != null ? { ...m, value: Math.round(liveVal * 10) / 10, deviationPct: m.baseline ? ((liveVal - m.baseline.mean) / m.baseline.mean) * 100 : null } : m;
  const out: AiOut[] = [{ text: `${describe(mm)} ${WHY[m.id] ?? ''}`, priority: m.status === 'red' ? 'red' : m.status === 'yellow' ? 'yellow' : undefined, zone: m.zone }];
  if (m.status !== 'green') {
    const p = protocolSteps(c, m.zone);
    if (p) out.push({ text: `Onboard protocol — ${p.title}:`, steps: p.steps.slice(0, 5), zone: m.zone, action: 'open-zone' });
  }
  if (hit.role === 'mind' && (m.id === 'mood' || m.id === 'stressVas')) {
    out.push({ text: 'Feeling this way on a long mission is common and it is OK to say so. A short breathing exercise can help right now, and the CMO and the psychological support team are available to talk.', action: 'breathing' });
  }
  return { role: hit.role, out };
}

export const zoneName = (z: ZoneId) => ZONES[z].name;
