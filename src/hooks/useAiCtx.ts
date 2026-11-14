'use client';
import { useMemo } from 'react';
import type { useDashboard } from '@/hooks/useDashboard';
import type { AiCtx } from '@/lib/astroAI';

export function useAiCtx(d: ReturnType<typeof useDashboard>): AiCtx {
  return useMemo(() => ({ a: d.astronaut, log: d.log, history: d.history, result: d.result, scores: d.scores, tick: d.tick, env: d.env }),
    // tick changes every second; the AI text only depends on its values, so key on its seq/alert level
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.astronaut, d.log, d.history, d.result, d.scores, d.env, d.tick?.alertLevel, d.tick?.activeFlags.length]);
}
