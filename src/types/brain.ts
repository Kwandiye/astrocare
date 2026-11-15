import { z } from 'zod';
import { ZONE_IDS } from './health';

const AlertLevelSchema = z.enum(['green', 'yellow', 'red']);
const MissionPhaseSchema = z.enum(['PHASE_1_ACUTE_ADAPTATION', 'PHASE_2_LONG_DURATION']);

/** Contract of the backend "brain": one JSON message per tick over WebSocket. Extended fields are optional. */
export const FlagSchema = z.object({
  type: z.enum(['vitals', 'radiation', 'exercise', 'nutrition', 'sleep', 'mood']),
  severity: z.enum(['warning', 'critical']),
  reason: z.string(),
  triggeredValue: z.number(),
  metric: z.string().optional(),
  zone: z.enum(ZONE_IDS).optional(),
  threshold: z.number().optional(),
  unit: z.string().optional(),
  normalRange: z.tuple([z.number(), z.number()]).optional(),
  deviationPct: z.number().optional(),
  sustainedSec: z.number().optional(),
});

export const StepSchema = z.object({
  text: z.string(),
  durationMin: z.number().optional(),
  escalation: z.boolean().optional(),
});

export const FlagDetailSchema = z.object({
  code: z.string(),
  severity: z.enum(['yellow', 'red']),
  message: z.string(),
  value: z.number().nullable(),
  threshold: z.number().nullable(),
  evidenceRef: z.string().nullable().optional(),
});

export const ResourceSchema = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  essentialUnits: z.object({ best: z.number(), worst: z.number() }),
  onboard: z.boolean().nullable(),
});

export const LikelyConditionSchema = z.object({
  code: z.string(),
  label: z.string(),
  confidence: z.number(),
  drivers: z.array(z.string()),
  evidenceRef: z.string(),
  phaseAdjusted: z.boolean().optional(),
  resources: z.array(ResourceSchema).optional(),
  onboardCapability: z.object({
    status: z.enum(['full', 'partial', 'none', 'unknown', 'no_rt']),
    missing: z.array(z.string()),
  }).optional(),
});

const PlanSchema = z.object({
  status: z.string(),
  reason: z.string().optional(),
  sessions: z.array(z.object({
    type: z.enum(['resistive', 'aerobic']),
    minutes: z.number(),
    note: z.string(),
  })).optional(),
  targetMinutes: z.number().optional(),
  targetKcal: z.number().nullable().optional(),
  hydration: z.string().optional(),
  evidenceRef: z.string().optional(),
});

export const BodyTrajectorySchema = z.object({
  missionDay: z.number(),
  exerciseAdherence: z.number(),
  adherenceSource: z.enum(['sample', 'assumed']).optional(),
  populationModel: z.literal(true),
  disclaimer: z.string(),
  evidenceRef: z.string().optional(),
  parameters: z.array(z.object({
    code: z.string(),
    label: z.string(),
    unit: z.string(),
    missionDay: z.number(),
    expected: z.number(),
    lower: z.number(),
    upper: z.number(),
    adherenceUsed: z.number(),
    extrapolated: z.boolean(),
    evidenceRef: z.string(),
    status: z.enum(['VERIFIED', 'VERIFY']),
  })),
});

export const BrainTickSchema = z.object({
  timestamp: z.string(),
  alertLevel: AlertLevelSchema,
  activeFlags: z.array(FlagSchema),
  rawVitals: z
    .object({
      hr: z.number(),
      spo2: z.number(),
      temp_c: z.number(),
      resp_rate: z.number(),
      radiation_dose_rate: z.number(),
      bp_sys: z.number().optional(),
      bp_dia: z.number().optional(),
      glucose_mgdl: z.number().optional(),
      radiation_cumulative_msv: z.number().optional(),
    })
    .catchall(z.number().optional()),
  doctorRecommendation: z.string(),
  news2Score: z.number().optional(),
  flagDetails: z.array(FlagDetailSchema).optional(),
  likelyConditions: z.array(LikelyConditionSchema).optional(),
  bodySystems: z.record(z.string(), AlertLevelSchema).optional(),
  plans: z.object({ exercise: PlanSchema, nutrition: PlanSchema }).optional(),
  bodyTrajectory: BodyTrajectorySchema.optional(),
  doctorSource: z.enum(['llm', 'cache', 'fallback']).optional(),
  medicalKit: z.array(z.string()).optional(),
  missionPhase: MissionPhaseSchema.optional(),
  seq: z.number().optional(),
  astronautId: z.string().optional(),
  missionDay: z.number().optional(),
  environment: z.string().optional(),
  steps: z.array(StepSchema).optional(),
  radiation_cumulative_msv: z.number().optional(),
});

export type BrainFlag = z.infer<typeof FlagSchema>;
export type BrainStep = z.infer<typeof StepSchema>;
export type BrainTick = z.infer<typeof BrainTickSchema>;
export type AlertLevel = BrainTick['alertLevel'];

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

export function parseTick(raw: unknown): BrainTick | null {
  const r = BrainTickSchema.safeParse(raw);
  if (!r.success) {
    // eslint-disable-next-line no-console
    console.warn('[brain] malformed tick ignored', r.error.issues.slice(0, 3));
    return null;
  }
  return r.data;
}
