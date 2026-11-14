import type { MetricId, TriageStatus, ZoneId } from '@/types/health';

export type StepIcon =
  | 'stop' | 'measure' | 'water' | 'breath' | 'check' | 'phone' | 'mask' | 'shield' | 'food' | 'sleep'
  | 'eye' | 'dumbbell' | 'pill' | 'thermo' | 'clipboard' | 'move';

export interface ProtocolStep { text: string; durationMin?: number; icon: StepIcon; isEscalation?: boolean }
export interface Protocol { id: string; title: string; severity: 'yellow' | 'red'; steps: ProtocolStep[]; references: string[] }

export const DISCLAIMER =
  'Decision-support prototype, not a medical device. If symptoms are unresolved or worsening → contact the flight surgeon.';

type Key = 'cardio' | 'respiratory' | 'neuro' | 'sans' | 'vestibular' | 'glucose' | 'renal' | 'nutrition' | 'bone' | 'joint' | 'muscle' | 'thermal' | 'radiation';

const ZONE_KEY: Record<ZoneId, Key> = {
  heart: 'cardio', lungs: 'respiratory', brain: 'neuro', eyes: 'sans', inner_ear: 'vestibular',
  liver: 'glucose', pancreas: 'glucose', kidneys: 'renal', stomach_gi: 'nutrition',
  spine: 'bone', skeleton_upper: 'bone', skeleton_lower: 'bone', knees: 'joint',
  muscles_arms: 'muscle', muscles_legs: 'muscle', skin_immune: 'thermal',
};

export function protocolIdFor(zone: ZoneId, status: TriageStatus, driverMetric?: MetricId): string | null {
  if (status !== 'yellow' && status !== 'red') return null;
  let key = ZONE_KEY[zone];
  if (zone === 'skin_immune' && (driverMetric === 'radiationMsvDay' || driverMetric === 'cumulativeDoseMsv')) key = 'radiation';
  return `${key}_${status}`;
}

const P = (id: string, title: string, severity: 'yellow' | 'red', references: string[], steps: ProtocolStep[]): Protocol =>
  ({ id, title, severity, references, steps });

const ESC_CMO = (cond: string): ProtocolStep => ({ text: `${cond} → notify the Crew Medical Officer (CMO); log it in the daily report.`, icon: 'phone', isEscalation: true });
const ESC_FS = (cond: string): ProtocolStep => ({ text: `${cond} → notify CMO and the flight surgeon, attach the 24 h report.`, icon: 'phone', isEscalation: true });

export const PROTOCOLS: Record<string, Protocol> = Object.fromEntries([
  P('cardio_yellow', 'Heart rate / blood pressure drifting', 'yellow', ['NASA-STD-3001 Vol.1', 'NASA HRP Cardiovascular Risk'], [
    { text: 'Pause strenuous work and rest for 5 minutes, feet in foot loops.', durationMin: 5, icon: 'stop' },
    { text: 'Re-measure HR and BP (arm at heart level, cuff on bare arm).', durationMin: 3, icon: 'measure' },
    { text: 'Drink 500 mL of water with electrolytes.', durationMin: 5, icon: 'water' },
    { text: 'Do 5 min of paced breathing — 6 breaths per minute.', durationMin: 5, icon: 'breath' },
    ESC_CMO('If HR is still > 20% above baseline after 30 min'),
  ]),
  P('cardio_red', 'Cardiovascular alert', 'red', ['NASA-STD-3001 Vol.1', 'ISS Medical Checklist'], [
    { text: 'Stop current activity and secure yourself to a restraint.', durationMin: 1, icon: 'stop' },
    { text: 'Measure HR and BP again in 5 min; record symptoms (chest pain, dizziness).', durationMin: 5, icon: 'measure' },
    { text: 'Hydrate 500 mL with electrolytes.', durationMin: 5, icon: 'water' },
    { text: 'Run 5-min HRV breathing (6 breaths/min).', durationMin: 5, icon: 'breath' },
    { text: 'Re-check: if HR < 100 bpm and BP normal → back to monitoring.', durationMin: 2, icon: 'check' },
    ESC_FS('If not resolved or chest pain present'),
  ]),
  P('respiratory_yellow', 'Breathing / cabin CO₂ above limit', 'yellow', ['NASA-STD-3001 Vol.2 §6.2', 'OCHMO-TB-004 CO₂'], [
    { text: 'Check the module ppCO₂ display and the CDRA status.', durationMin: 2, icon: 'clipboard' },
    { text: 'Move to the module with the best ventilation; add a portable fan near your face.', durationMin: 5, icon: 'move' },
    { text: 'Re-measure SpO₂ and respiratory rate after 10 min.', durationMin: 10, icon: 'measure' },
    { text: 'Avoid heavy exercise until ppCO₂ < 3.0 mmHg.', icon: 'stop' },
    ESC_CMO('If headache, dizziness or SpO₂ < 94% persist'),
  ]),
  P('respiratory_red', 'CO₂ emergency / low oxygen', 'red', ['ISS Flight Rule B17-5', 'NASA-STD-3001 Vol.2'], [
    { text: 'Put on the O₂ mask or move immediately to a module with better ventilation.', durationMin: 1, icon: 'mask' },
    { text: 'Report to the commander and start the CO₂ emergency checklist.', durationMin: 2, icon: 'phone' },
    { text: 'Re-measure SpO₂ in 5 min; watch for headache, dizziness, confusion.', durationMin: 5, icon: 'measure' },
    { text: 'No exercise or EVA prep until ppCO₂ < 3.0 mmHg and SpO₂ ≥ 96%.', icon: 'stop' },
    ESC_FS('If SpO₂ < 92% after 10 min on O₂'),
  ]),
  P('neuro_yellow', 'Fatigue / sleep / cognition drifting', 'yellow', ['NASA HRP Sleep Loss Risk', 'NASA HRP BMed Risk'], [
    { text: 'Plan a 20-min nap or move your sleep window earlier tonight.', durationMin: 20, icon: 'sleep' },
    { text: 'Use bright light in the morning and dim light 1 h before sleep.', icon: 'sleep' },
    { text: 'Postpone critical tasks or ask for a second-person check.', icon: 'clipboard' },
    { text: 'Repeat the 3-min PVT test after rest.', durationMin: 3, icon: 'measure' },
    ESC_CMO('If PVT stays > 500 ms or mood stays low for 2 days'),
  ]),
  P('neuro_red', 'Severe fatigue — impaired cognition', 'red', ['NASA HRP Sleep Loss Risk', 'OCHMO-TB-004'], [
    { text: 'Stop safety-critical tasks (robotics, EVA prep, piloting).', durationMin: 1, icon: 'stop' },
    { text: 'Check cabin ppCO₂ — CO₂ is a common hidden cause.', durationMin: 2, icon: 'clipboard' },
    { text: 'Rest in your crew quarters for at least 60 min.', durationMin: 60, icon: 'sleep' },
    { text: 'Repeat PVT; a crewmate double-checks your next task.', durationMin: 5, icon: 'measure' },
    ESC_FS('If PVT > 600 ms or confusion persists'),
  ]),
  P('sans_yellow', 'Eye pressure rising (early SANS)', 'yellow', ['NASA HRP SANS Risk'], [
    { text: 'Do a near- and far-vision self-check with the Amsler grid.', durationMin: 3, icon: 'eye' },
    { text: 'Schedule an OCT / fundoscopy exam this week.', icon: 'clipboard' },
    { text: 'Limit head-down posture and heavy straining; consider thigh cuffs if available.', icon: 'stop' },
    ESC_CMO('If vision changes or headaches appear'),
  ]),
  P('sans_red', 'Optic disc edema (SANS)', 'red', ['NASA HRP SANS Risk', 'NASA-STD-3001 Vol.1'], [
    { text: 'Record a fundus image and OCT scan; attach them to the report.', durationMin: 15, icon: 'eye' },
    { text: 'Use corrective (+) lenses for near work if vision is blurred.', icon: 'eye' },
    { text: 'Avoid resistive exercise with breath-holding (Valsalva).', icon: 'stop' },
    ESC_FS('Always for optic disc edema'),
  ]),
  P('vestibular_yellow', 'Motion sickness', 'yellow', ['NASA HRP Sensorimotor Risk'], [
    { text: 'Keep your head still and align your body with the module "floor".', durationMin: 5, icon: 'move' },
    { text: 'Take the anti-motion-sickness medication from the medical kit if prescribed.', icon: 'pill' },
    { text: 'Sip water slowly; eat small dry meals.', icon: 'water' },
    ESC_CMO('If vomiting repeats or symptoms last > 72 h'),
  ]),
  P('vestibular_red', 'Severe motion sickness', 'red', ['NASA HRP Sensorimotor Risk'], [
    { text: 'Secure yourself in a sleep station; minimise head movement.', durationMin: 1, icon: 'stop' },
    { text: 'Use the prescribed injectable anti-emetic with CMO help.', icon: 'pill' },
    { text: 'Replace fluids: 250 mL every 30 min if tolerated.', icon: 'water' },
    ESC_FS('If unable to keep fluids down for 6 h'),
  ]),
  P('glucose_yellow', 'Blood glucose out of range', 'yellow', ['NASA HRP Nutrition Risk'], [
    { text: 'Re-test with a new finger-prick strip.', durationMin: 2, icon: 'measure' },
    { text: 'If low (< 70 mg/dL): eat 15 g fast carbs, re-test in 15 min.', durationMin: 15, icon: 'food' },
    { text: 'If high (> 180 mg/dL): drink water, light activity, re-test in 1 h.', durationMin: 60, icon: 'water' },
    ESC_CMO('If two readings in a row are out of range'),
  ]),
  P('glucose_red', 'Dangerous blood glucose', 'red', ['NASA-STD-3001 Vol.1'], [
    { text: 'If < 54 mg/dL: take glucose gel now and tell a crewmate.', durationMin: 1, icon: 'food' },
    { text: 'Re-test every 15 min until in range.', durationMin: 15, icon: 'measure' },
    { text: 'If > 250 mg/dL: hydrate and check for ketones/illness.', icon: 'water' },
    ESC_FS('Always for glucose < 54 or > 250 mg/dL'),
  ]),
  P('renal_yellow', 'Low fluid intake — kidney-stone risk', 'yellow', ['NASA HRP Renal Stone Risk'], [
    { text: 'Drink at least 2.5 L today; set hourly reminders.', icon: 'water' },
    { text: 'Reduce salt and animal protein at the next meal.', icon: 'food' },
    { text: 'Watch for flank pain or blood in urine.', icon: 'clipboard' },
    ESC_CMO('If flank pain appears'),
  ]),
  P('renal_red', 'Severe dehydration / suspected stone', 'red', ['NASA HRP Renal Stone Risk'], [
    { text: 'Drink 500 mL now, then 250 mL every 30 min.', durationMin: 30, icon: 'water' },
    { text: 'Use the ultrasound to image the kidneys with CMO guidance.', durationMin: 20, icon: 'measure' },
    { text: 'Take pain relief from the medical kit as prescribed.', icon: 'pill' },
    ESC_FS('If pain is severe or there is blood in urine'),
  ]),
  P('nutrition_yellow', 'Under-eating / weight loss', 'yellow', ['NASA HRP Nutrition Risk'], [
    { text: 'Add a protein snack (≥ 20 g) today.', icon: 'food' },
    { text: 'Log every meal for the next 3 days.', icon: 'clipboard' },
    { text: 'Weigh yourself on the body-mass device on the same time tomorrow.', icon: 'measure' },
    ESC_CMO('If body mass drops > 2% in a week'),
  ]),
  P('nutrition_red', 'Significant weight loss', 'red', ['NASA HRP Nutrition Risk'], [
    { text: 'Follow the high-energy menu plan (+500 kcal/day).', icon: 'food' },
    { text: 'Check for nausea, appetite loss or GI symptoms.', icon: 'clipboard' },
    ESC_FS('Always'),
  ]),
  P('bone_yellow', 'Bone loss faster than expected', 'yellow', ['NASA HRP Bone Fracture Risk', 'NASA-STD-3001 Vol.1'], [
    { text: 'Do the full ARED resistance session today (squats, deadlifts, heel raises).', durationMin: 60, icon: 'dumbbell' },
    { text: 'Check calcium (1000 mg) and vitamin D (800 IU) intake.', icon: 'food' },
    { text: 'Drink ≥ 2.5 L of water (calcium released from bone raises stone risk).', icon: 'water' },
    ESC_CMO('If the rate stays above 1.0 %/month for 30 days'),
  ]),
  P('bone_red', 'Severe bone loss', 'red', ['NASA HRP Bone Fracture Risk'], [
    { text: 'Increase ARED load per the flight-surgeon plan; avoid impact/twist loads.', icon: 'dumbbell' },
    { text: 'Discuss bisphosphonate countermeasure with the CMO.', icon: 'pill' },
    ESC_FS('Always'),
  ]),
  P('joint_yellow', 'Joint pain', 'yellow', ['NASA HRP EVA Injury Risk'], [
    { text: 'Rest the joint; avoid loaded movements for 24 h.', icon: 'stop' },
    { text: 'Apply a cold pack for 15 min.', durationMin: 15, icon: 'thermo' },
    { text: 'Re-rate the pain tomorrow in the daily check-in.', icon: 'clipboard' },
    ESC_CMO('If pain ≥ 4/10 for 3 days'),
  ]),
  P('joint_red', 'Severe joint pain', 'red', ['NASA HRP EVA Injury Risk'], [
    { text: 'Immobilise the joint; no exercise on it.', icon: 'stop' },
    { text: 'Take pain relief as prescribed.', icon: 'pill' },
    ESC_FS('Always — consider ultrasound'),
  ]),
  P('muscle_yellow', 'Not enough exercise', 'yellow', ['NASA HRP Muscle Risk', 'NASA HRP Aerobic Capacity Risk'], [
    { text: 'Make up the session: 30 min treadmill/cycle + 30 min ARED.', durationMin: 60, icon: 'dumbbell' },
    { text: 'Eat 20–30 g of protein within 1 h after exercise.', icon: 'food' },
    ESC_CMO('If 3 sessions in a row are missed'),
  ]),
  P('muscle_red', 'Severe deconditioning', 'red', ['NASA HRP Muscle Risk'], [
    { text: 'Follow the reconditioning plan from the exercise physiologist.', icon: 'dumbbell' },
    ESC_FS('Always'),
  ]),
  P('thermal_yellow', 'Temperature out of range', 'yellow', ['NASA HRP Immune Risk'], [
    { text: 'Re-measure core temperature in 15 min.', durationMin: 15, icon: 'thermo' },
    { text: 'Check for rash, sore throat, cold sores (viral reactivation).', icon: 'clipboard' },
    { text: 'Hydrate and rest; take a photo of any rash for the report.', icon: 'water' },
    ESC_CMO('If fever ≥ 38 °C lasts more than 24 h'),
  ]),
  P('thermal_red', 'High fever / hypothermia', 'red', ['NASA HRP Immune Risk'], [
    { text: 'Rest and isolate in your crew quarters if infection is suspected.', icon: 'stop' },
    { text: 'Take antipyretic as prescribed; re-measure every 30 min.', durationMin: 30, icon: 'pill' },
    ESC_FS('Always'),
  ]),
  P('radiation_yellow', 'Elevated radiation dose', 'yellow', ['NASA-STD-3001 Vol.1 §4.8', 'CSA Radiation in space'], [
    { text: 'Check the space-weather alert and the personal dosimeter.', durationMin: 2, icon: 'clipboard' },
    { text: 'Spend sleep and rest time in the most shielded area (crew quarters with water walls).', icon: 'shield' },
    { text: 'Postpone EVA.', icon: 'stop' },
    ESC_CMO('If the dose rate keeps rising'),
  ]),
  P('radiation_red', 'Solar particle event — take shelter', 'red', ['NASA-STD-3001 Vol.1 §4.8', 'CSA Radiation in space'], [
    { text: 'Go to the shielded storm shelter NOW. Take your dosimeter.', durationMin: 1, icon: 'shield' },
    { text: 'Stay until the all-clear from Mission Control / space-weather alert.', icon: 'stop' },
    { text: 'Record symptoms: nausea, vomiting, fatigue, skin redness.', icon: 'clipboard' },
    ESC_FS('Always — report dose and symptoms'),
  ]),
].map((p) => [p.id, p]));

export const getProtocol = (id: string | null | undefined) => (id ? PROTOCOLS[id] ?? null : null);
