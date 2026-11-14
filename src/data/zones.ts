import type { SystemId, ZoneId } from '@/types/health';

export type Hazard = 'Radiation' | 'Isolation & Confinement' | 'Distance from Earth' | 'Gravity Fields' | 'Hostile/Closed Environment';

export const HAZARD_COLORS: Record<Hazard, string> = {
  Radiation: '#A78BFA',
  'Isolation & Confinement': '#F472B6',
  'Distance from Earth': '#60A5FA',
  'Gravity Fields': '#22C55E',
  'Hostile/Closed Environment': '#FB923C',
};

export const SYSTEM_LABEL: Record<SystemId, string> = {
  cardiovascular: 'Cardiovascular',
  neuro_ocular: 'Neuro-ocular & vestibular',
  neuro_behavioral: 'Neuro-behavioral',
  respiratory_environment: 'Respiratory & environment',
  endocrine_metabolic: 'Endocrine & metabolic',
  musculoskeletal_immune: 'Musculoskeletal & immune',
};

export interface ZoneInfo {
  name: string;
  layer: 'organ' | 'skeleton' | 'muscle' | 'aura';
  about: string;
  risks: string[];
  measure: string; // Q1 Can it be measured in space?
  why: string; // Q2 Why this exam?
  hazards: Hazard[]; // Q3
  hazardText: string;
  whenYellow: string; // Q4
  whenRed: string;
  prevent: string[]; // Q5
}

export const ZONES: Record<ZoneId, ZoneInfo> = {
  brain: {
    name: 'Brain & cognition', layer: 'organ',
    about: 'Fluid shifts toward the head, CO₂, noise and broken sleep cycles slow reactions and change mood. Isolation adds psychological load.',
    risks: ['Sleep loss & circadian misalignment', 'Slowed reaction time (PVT)', 'Stress, low mood, conflict'],
    measure: 'Yes — actigraphy watch for sleep, 3-min PVT-B reaction test on a tablet, short mood/stress questionnaires (VAS).',
    why: 'Fatigue and slow reactions cause mistakes during robotics, docking and EVA. Mood shows behavioral-health risk early.',
    hazards: ['Isolation & Confinement', 'Hostile/Closed Environment', 'Distance from Earth'],
    hazardText: '16 sunrises a day, noise, high CO₂ and confinement disturb sleep; on Mars there is no quick talk with family.',
    whenYellow: 'PVT worst-10% > 500 ms, sleep efficiency < 89.2%, or stress well above your baseline → self-care, tell the CMO.',
    whenRed: 'Mission Fatigue Index ≥ 65, PVT > 600 ms, confusion → stop critical tasks, contact the flight surgeon.',
    prevent: ['Fixed sleep window, eye mask, earplugs', 'Bright light in the morning', 'Private family calls, Cupola breaks', 'Check cabin CO₂ when tired'],
  },
  eyes: {
    name: 'Eyes (SANS)', layer: 'organ',
    about: 'Headward fluid shift raises pressure behind the eye. Many long-duration astronauts develop optic disc edema and far-sighted shift (SANS).',
    risks: ['Optic disc edema', 'Choroidal folds', 'Blurred near vision'],
    measure: 'Yes — tonometer for intraocular pressure, OCT and fundoscope imaging on ISS, Amsler grid self-test.',
    why: 'SANS is unique to spaceflight and may cause lasting vision changes; early detection lets the flight surgeon act.',
    hazards: ['Gravity Fields', 'Hostile/Closed Environment'],
    hazardText: 'Without gravity, fluids move to the head. High CO₂ may make it worse.',
    whenYellow: 'IOP rising > 1.5σ above your baseline or vision changes → schedule an OCT, tell the CMO.',
    whenRed: 'Optic disc edema on OCT → always contact the flight surgeon.',
    prevent: ['Weekly Amsler grid check', 'Avoid long head-down postures', 'Thigh cuffs / lower-body negative pressure if available'],
  },
  inner_ear: {
    name: 'Inner ear (vestibular)', layer: 'organ',
    about: 'The balance organ loses its "down" signal. Most crew get space motion sickness in the first days and dizziness after landing.',
    risks: ['Space motion sickness', 'Disorientation', 'Post-landing dizziness and falls'],
    measure: 'Yes — symptom score 0–10 in the daily check-in; balance and gaze tests before/after flight.',
    why: 'Nausea and vomiting reduce food, fluid intake and work ability during the critical first days.',
    hazards: ['Gravity Fields'],
    hazardText: 'Gravity changes (launch, 0 g, Moon 0.16 g, Mars 0.38 g, landing) confuse the vestibular system.',
    whenYellow: 'Motion sickness ≥ 4/10 → medication from the kit, limit head movement.',
    whenRed: 'Score ≥ 7/10 or cannot keep fluids → CMO + flight surgeon.',
    prevent: ['Move slowly in the first 72 h', 'Align with the module "floor"', 'Pre-flight vestibular training'],
  },
  heart: {
    name: 'Heart', layer: 'organ',
    about: 'Fluid shift and lighter work make the heart slightly smaller and lower HR and diastolic pressure. After landing, standing up can cause fainting.',
    risks: ['Cardiac atrophy', 'Arrhythmias', 'Orthostatic intolerance after landing'],
    measure: 'Yes — chest-strap / Bio-Monitor shirt for HR & HRV, automatic BP cuff, ECG, ultrasound.',
    why: 'HR and BP show stress, dehydration, fever, CO₂ and overtraining; HRV shows recovery.',
    hazards: ['Gravity Fields', 'Radiation', 'Isolation & Confinement'],
    hazardText: 'Microgravity deconditions the heart; radiation may damage vessels long-term; stress raises HR.',
    whenYellow: 'Resting HR or BP 1.5–3σ from your baseline → rest, hydrate, re-measure in 30 min.',
    whenRed: 'HR > 130 or < 40, BP ≥ 180/120 or SBP < 90, chest pain → protocol + flight surgeon.',
    prevent: ['Daily aerobic exercise (treadmill/cycle)', 'Hydration 2.5 L+', 'Fluid loading before landing'],
  },
  lungs: {
    name: 'Lungs & cabin air', layer: 'organ',
    about: 'Lungs work fine in 0 g, but the closed cabin can accumulate CO₂ around a sleeping crewmember with poor airflow.',
    risks: ['Hypercapnia (CO₂) → headache, fatigue', 'Hypoxia during EVA/decompression', 'Dust (Moon/Mars)'],
    measure: 'Yes — pulse oximeter for SpO₂, wearable for breathing rate, cabin CO₂ sensors (CDRA telemetry).',
    why: 'Low oxygen or high CO₂ quickly affects the brain and performance.',
    hazards: ['Hostile/Closed Environment'],
    hazardText: 'Spacecraft air is recycled; a scrubber failure raises ppCO₂ in hours.',
    whenYellow: 'ppCO₂ > 3.0 mmHg (1-h avg) or SpO₂ < 94% → move to better ventilation, tell the CMO.',
    whenRed: 'ppCO₂ ≥ 7.6 mmHg (Flight Rule B17-5) or SpO₂ < 90% → O₂ mask, CO₂ emergency checklist, flight surgeon.',
    prevent: ['Fan in crew quarters', 'Check ppCO₂ before sleep', 'Keep CO₂ < 2.5 mmHg 7-day average'],
  },
  liver: {
    name: 'Liver', layer: 'organ',
    about: 'The liver controls glucose and processes medications; spaceflight changes metabolism and drug effects.',
    risks: ['Altered drug metabolism', 'Insulin resistance'],
    measure: 'Partly — glucose by finger-prick glucometer; full blood panels are sampled and analysed later.',
    why: 'Glucose shows energy balance and early insulin resistance.',
    hazards: ['Gravity Fields', 'Hostile/Closed Environment'],
    hazardText: 'Inactivity and diet changes affect insulin sensitivity.',
    whenYellow: 'Glucose < 70 or > 180 mg/dL → re-test, eat/hydrate, tell the CMO.',
    whenRed: 'Glucose < 54 or > 250 mg/dL → glucose gel / hydrate, flight surgeon.',
    prevent: ['Regular meals', 'Daily exercise', 'Limit sugary drinks'],
  },
  pancreas: {
    name: 'Pancreas (blood sugar)', layer: 'organ',
    about: 'Produces insulin. Reduced activity in 0 g can lower insulin sensitivity.',
    risks: ['Hypo- / hyperglycemia', 'Insulin resistance'],
    measure: 'Yes — finger-prick glucometer (mg/dL) before breakfast; continuous glucose monitors are being tested.',
    why: 'Blood sugar shows if energy intake matches the work load.',
    hazards: ['Gravity Fields'],
    hazardText: 'Less muscle work → less glucose uptake.',
    whenYellow: 'Glucose < 70 or > 180 mg/dL → protocol, tell the CMO.',
    whenRed: 'Glucose < 54 or > 250 mg/dL → flight surgeon.',
    prevent: ['Balanced meals', 'Resistance exercise improves insulin sensitivity'],
  },
  kidneys: {
    name: 'Kidneys', layer: 'organ',
    about: 'Calcium released from bones and lower fluid intake raise the risk of kidney stones in space.',
    risks: ['Kidney stones', 'Dehydration'],
    measure: 'Yes — fluid intake log, urine volume/colour, ultrasound imaging.',
    why: 'A kidney stone in space can end a mission; prevention is simple — drink more.',
    hazards: ['Gravity Fields', 'Distance from Earth'],
    hazardText: 'Bone loss puts calcium into urine; no hospital nearby.',
    whenYellow: 'Fluid intake < 2.0 L/day → drink more, reduce salt.',
    whenRed: 'Fluid < 1.2 L/day or flank pain → ultrasound, flight surgeon.',
    prevent: ['≥ 2.5 L water/day', 'Low-salt diet', 'Citrate supplements if prescribed'],
  },
  stomach_gi: {
    name: 'Stomach & nutrition', layer: 'organ',
    about: 'Appetite drops in space; many astronauts eat too little and lose body mass. Microbiome changes too.',
    risks: ['Energy deficit & weight loss', 'Low protein → muscle loss', 'Microbiome changes'],
    measure: 'Yes — food log (barcode/tablet), body-mass measuring device (SLAMMD).',
    why: 'Enough energy and protein protect muscles, bones and immunity.',
    hazards: ['Isolation & Confinement', 'Hostile/Closed Environment', 'Distance from Earth'],
    hazardText: 'Limited menu and food fatigue; long missions need stable food quality.',
    whenYellow: 'Energy or protein well below your baseline, mass trending down → add snacks.',
    whenRed: 'Mass drop > 5% → nutrition plan with flight surgeon.',
    prevent: ['Protein ≥ 1.2 g/kg', 'Variety and fresh food when possible', 'Weekly body-mass check'],
  },
  spine: {
    name: 'Spine', layer: 'skeleton',
    about: 'Without load the spine lengthens by up to 5 cm; back pain is common and vertebrae lose bone density.',
    risks: ['Back pain', 'Disc herniation after landing', 'Vertebral bone loss'],
    measure: 'Partly — pain score; bone density (DXA) only before/after flight, so loss is estimated from exercise data.',
    why: 'Loss in the spine raises fracture risk after landing.',
    hazards: ['Gravity Fields'],
    hazardText: 'No axial load in microgravity.',
    whenYellow: 'Estimated loss rate > 1.0 %/month → full ARED sessions.',
    whenRed: '> 1.5 %/month or severe pain → flight surgeon.',
    prevent: ['ARED squats/deadlifts', 'Core exercises', 'Calcium & vitamin D'],
  },
  skeleton_upper: {
    name: 'Upper skeleton', layer: 'skeleton',
    about: 'Arms and ribs carry little load anyway, so they lose less bone than hips and legs.',
    risks: ['Minor bone loss', 'Shoulder overuse during EVA'],
    measure: 'Partly — estimated from exercise; DXA before/after flight.',
    why: 'Shows whether resistance training covers the whole body.',
    hazards: ['Gravity Fields'],
    hazardText: 'Unloading in microgravity.',
    whenYellow: 'Loss rate > 0.6 %/month → upper-body ARED exercises.',
    whenRed: 'Fracture suspicion → flight surgeon.',
    prevent: ['Upper-body resistance exercises'],
  },
  skeleton_lower: {
    name: 'Hips & femurs', layer: 'skeleton',
    about: 'Weight-bearing bones lose ~1–1.5 % of density per month in microgravity — about as much as an elderly person loses in a year.',
    risks: ['Osteoporosis-like bone loss', 'Fracture after landing', 'Kidney stones (calcium)'],
    measure: 'Partly — DXA before/after flight; in flight the rate is estimated from exercise load and markers.',
    why: 'Hip fracture risk after return; recovery takes years.',
    hazards: ['Gravity Fields', 'Radiation'],
    hazardText: 'No load on bones; radiation may also harm bone cells.',
    whenYellow: 'Loss rate > 1.0 %/month → increase ARED load, check diet.',
    whenRed: '> 1.5 %/month → flight surgeon, consider medication.',
    prevent: ['ARED resistance exercise 6×/week', 'Calcium + vitamin D', 'Treadmill with harness load'],
  },
  knees: {
    name: 'Knees', layer: 'skeleton',
    about: 'Treadmill running with harness and EVA work load the knees; cartilage may also thin without load.',
    risks: ['Joint pain', 'Cartilage changes', 'EVA injury'],
    measure: 'Yes — pain score in check-in, ultrasound if needed.',
    why: 'Pain limits the exercise that protects bone and muscle.',
    hazards: ['Gravity Fields', 'Distance from Earth'],
    hazardText: 'Unusual loads during exercise and after landing.',
    whenYellow: 'Pain ≥ 4/10 → rest, cold pack.',
    whenRed: 'Pain ≥ 7/10 → flight surgeon.',
    prevent: ['Correct harness setup', 'Gradual load increase'],
  },
  muscles_arms: {
    name: 'Arm muscles', layer: 'muscle',
    about: 'Arms are used constantly in 0 g for moving, so they keep strength better than legs. EVA gloves strain hands and shoulders.',
    risks: ['Hand/shoulder EVA injury', 'Strength loss without ARED'],
    measure: 'Yes — resistance training minutes and loads from ARED.',
    why: 'Strength is needed for EVA and emergencies.',
    hazards: ['Gravity Fields'],
    hazardText: 'Less load overall; EVA suits stress hands.',
    whenYellow: 'Resistance training < 20 min → make up the session.',
    whenRed: 'Injury → flight surgeon.',
    prevent: ['ARED upper-body routine', 'Hand-strength exercises before EVA'],
  },
  muscles_legs: {
    name: 'Leg & back muscles', layer: 'muscle',
    about: 'Anti-gravity muscles (calves, quads, back) shrink fastest — up to 20 % in weeks without exercise.',
    risks: ['Muscle atrophy', 'Reduced VO₂max (< 36.5 ml/min/kg)', 'Falls after landing'],
    measure: 'Yes — exercise minutes and heart rate from treadmill/cycle/ARED, periodic fitness tests.',
    why: 'Strong legs are needed for emergency egress after landing on the Moon or Mars.',
    hazards: ['Gravity Fields'],
    hazardText: 'No weight to carry in microgravity.',
    whenYellow: 'Exercise < 45 min/day → make up the session.',
    whenRed: '3+ days without exercise → reconditioning plan.',
    prevent: ['~2 h exercise per day', 'Protein after exercise', 'Interval training on cycle'],
  },
  skin_immune: {
    name: 'Skin, immunity & radiation', layer: 'aura',
    about: 'Spaceflight weakens immune control: latent viruses (herpes, shingles) reactivate, rashes appear. Radiation adds long-term cancer risk.',
    risks: ['Viral reactivation, rashes, fever', 'Radiation dose (cancer risk)', 'Acute radiation sickness during a big solar event'],
    measure: 'Yes — skin/core thermometer, personal dosimeter, photo of rashes for the flight surgeon.',
    why: 'Fever or rash can be the first sign of infection; dose must stay within career limits.',
    hazards: ['Radiation', 'Isolation & Confinement', 'Hostile/Closed Environment'],
    hazardText: 'Cosmic rays and solar events; stress hormones suppress immunity in a closed crew.',
    whenYellow: 'Fever ≥ 38 °C, dose rate above the environment norm → re-check, shelter if needed.',
    whenRed: 'Core temp ≥ 39 °C or < 35 °C, solar particle event → storm shelter / flight surgeon.',
    prevent: ['Hand hygiene', 'Sleep and nutrition support immunity', 'Sleep in shielded quarters'],
  },
};

/** 3D anchors (meters, y-up, figure faces +z) used for camera focus and labels. */
export const ZONE_ANCHORS: Record<ZoneId, [number, number, number]> = {
  // organ centroids from public/models/astronaut_anatomy.anchors.json (scripts/blender/build_anatomy.py),
  // paired organs / limbs placed on the left side so labels don't sit between them
  brain: [0, 1.632, -0.017], eyes: [0.03, 1.591, 0.066], inner_ear: [0.04, 1.58, 0], heart: [0.02, 1.29, 0.028],
  lungs: [0.07, 1.30, 0.004], liver: [-0.06, 1.187, 0.036], pancreas: [0.005, 1.121, 0.025], kidneys: [0.06, 1.10, -0.02],
  stomach_gi: [0.03, 1.026, 0.016], spine: [0, 1.207, -0.046], skeleton_upper: [0.1, 1.376, 0.011], skeleton_lower: [0.11, 0.62, 0.006],
  knees: [0.11, 0.44, 0.02], muscles_arms: [0.3, 1.165, -0.03], muscles_legs: [0.12, 0.62, 0], skin_immune: [0, 1.0, 0],
};
