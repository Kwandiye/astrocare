'use client';
import { useMemo } from 'react';
import { getMissionSeries } from '@/data/generator';
import { applyEnvironment } from '@/lib/simulator';
import type { useDashboard } from '@/hooks/useDashboard';

/** Whole-mission daily logs for the selected astronaut, with today's effective log (check-in, what-ifs) in place. */
export function useMission(d: ReturnType<typeof useDashboard>) {
  return useMemo(() => {
    const s = getMissionSeries(d.astronaut.id).map((l) => applyEnvironment(l, d.env.id));
    s[d.log.missionDay] = d.log;
    return s;
  }, [d.astronaut.id, d.env.id, d.log]);
}
