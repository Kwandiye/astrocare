export type MissionPhase = 'preflight' | 'phase1_adaptation' | 'phase2_longduration' | 'postflight';
export type TriageStatus = 'green' | 'yellow' | 'red' | 'stale';

export const ZONE_IDS = [
  'brain', 'eyes', 'inner_ear', 'heart', 'lungs', 'liver', 'pancreas', 'kidneys', 'stomach_gi',
  'spine', 'skeleton_upper', 'skeleton_lower', 'knees', 'muscles_arms', 'muscles_legs', 'skin_immune',
] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export const SYSTEM_IDS = [
  'cardiovascular', 'neuro_ocular', 'neuro_behavioral', 'respiratory_environment',
  'endocrine_metabolic', 'musculoskeletal_immune',
] as const;
export type SystemId = (typeof SYSTEM_IDS)[number];

export const ZONE_SYSTEM: Record<ZoneId, SystemId> = {
  heart: 'cardiovascular',
  eyes: 'neuro_ocular',
  inner_ear: 'neuro_ocular',
  brain: 'neuro_behavioral',
  lungs: 'respiratory_environment',
  liver: 'endocrine_metabolic',
  pancreas: 'endocrine_metabolic',
  kidneys: 'endocrine_metabolic',
  stomach_gi: 'endocrine_metabolic',
  spine: 'musculoskeletal_immune',
  skeleton_upper: 'musculoskeletal_immune',
  skeleton_lower: 'musculoskeletal_immune',
  knees: 'musculoskeletal_immune',
  muscles_arms: 'musculoskeletal_immune',
  muscles_legs: 'musculoskeletal_immune',
  skin_immune: 'musculoskeletal_immune',
};

export type InputSource = 'wearable' | 'manual' | 'camera' | 'environment';

/** One astronaut, one mission day. Glucose in mg/dL (as in the challenge brief). */
export interface DailyTelemetryLog {
  astronautId: string;
  missionDay: number;
  phase: MissionPhase;
  hr: number;
  hrvRmssd: number;
  sbp: number;
  dbp: number;
  spo2: number;
  respRate: number;
  skinTemp: number;
  coreTemp: number;
  glucose: number;
  sleepHours: number;
  sleepEfficiency: number;
  pvtWorst10Ms: number;
  stressVas: number;
  mood: number; // 1–5
  ppCO2: number;
  radiationMsvDay: number;
  cumulativeDoseMsv: number;
  exerciseMinutes: number;
  resistanceMinutes: number;
  iop: number;
  opticDiscEdema: boolean;
  hydrationMl: number;
  kcalIntake: number;
  proteinG: number;
  bodyMassKg: number;
  motionSickness: number; // 0–10
  bmdLossRatePctMonth: number;
  bmdLossCumulativePct: number;
  pain: Partial<Record<ZoneId, number>>; // 0–10, from check-in
  symptoms: string[];
  events: MissionEventType[];
  inputSource: InputSource;
  /** normal daily radiation background of the current environment (mSv/day) */
  envRadiationBaseline?: number;
}

export type MissionEventType = 'eva' | 'spe' | 'cdra_failure' | 'circadian_shift' | 'skipped_exercise' | 'sans_exam';

export interface Baseline { mean: number; sd: number }

/** Numeric log keys that are evaluated as metrics. */
export type MetricId =
  | 'hr' | 'hrvRmssd' | 'sbp' | 'dbp' | 'spo2' | 'respRate' | 'ppCO2'
  | 'sleepHours' | 'sleepEfficiency' | 'pvtWorst10Ms' | 'stressVas' | 'mood' | 'mfi'
  | 'iop' | 'opticDiscEdema' | 'motionSickness'
  | 'kcalIntake' | 'proteinG' | 'bodyMassKg' | 'glucose' | 'hydrationMl'
  | 'bmdLossRatePctMonth' | 'bmdUpperRatePctMonth' | 'exerciseMinutes' | 'resistanceMinutes'
  | 'skinTemp' | 'coreTemp' | 'radiationMsvDay' | 'cumulativeDoseMsv' | 'pain';

export interface Metric {
  id: MetricId;
  label: string;
  unit: string;
  value: number;
  baseline: Baseline | null; // null for absolute-threshold metrics
  zScore: number | null;
  deviationPct: number | null;
  status: TriageStatus;
  reason: string | null; // why not green
  trend7d: number[];
  source: InputSource;
}

export interface ZoneState {
  zoneId: ZoneId;
  system: SystemId;
  status: TriageStatus;
  metrics: Metric[];
  drivers: string[];
  protocolId: string | null;
}

export interface Syndrome {
  id: string;
  name: string;
  status: Exclude<TriageStatus, 'stale' | 'green'>;
  explanation: string;
  zones: ZoneId[];
}

export interface TriageResult {
  astronautId: string;
  missionDay: number;
  phase: MissionPhase;
  overall: TriageStatus;
  zones: Record<ZoneId, ZoneState>;
  systems: Record<SystemId, TriageStatus>;
  mfi: number;
  syndromes: Syndrome[];
}

export interface Astronaut {
  id: string;
  name: string;
  role: string;
  age: number;
  initials: string;
  color: string;
  story: string;
  /** baselines per metric per phase */
  baselines: Record<'phase1_adaptation' | 'phase2_longduration', Partial<Record<MetricId, Baseline>>>;
}
