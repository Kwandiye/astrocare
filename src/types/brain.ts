import { z } from 'zod';
import { ZONE_IDS } from './health';

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

export const BrainTickSchema = z.object({
  timestamp: z.string(),
  alertLevel: z.enum(['green', 'yellow', 'red']),
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
