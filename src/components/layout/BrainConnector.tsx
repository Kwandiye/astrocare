'use client';
import { useEffect } from 'react';
import { startBrain } from '@/lib/brainSocket';
import { useHealthStore } from '@/store/useHealthStore';

/** Starts the WebSocket brain client (or in-browser mock) once for the whole app. */
export function BrainConnector() {
  useEffect(() => {
    const st = useHealthStore.getState;
    const stop = startBrain({
      url: process.env.NEXT_PUBLIC_BRAIN_WS_URL || undefined,
      onTick: (t) => st().pushTick(t),
      onState: (connection) => st().set({ connection }),
      onMode: (mode) => st().set({ mode }),
      getMockContext: () => {
        const s = st();
        if (s.signalPaused) return null;
        return { astronautId: s.astronautId, day: s.day, envId: s.envId, overrides: s.overrides[`${s.astronautId}:${s.day}`], whatIfs: s.whatIfs };
      },
    });
    return stop;
  }, []);
  return null;
}
