'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useHealthStore } from '@/store/useHealthStore';
import { envById } from '@/lib/environments';

/**
 * Demo mode: replays the scripted astro-01 story (day 45 → 53) in ~60 s on a Mars transit:
 * rings change, lungs/brain/heart go yellow then red, camera flies to the lungs, the protocol opens,
 * and the escalation shows the Mars comm-delay countdown.
 */
export function useDemo() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const stop = useCallback(() => {
    clear();
    useHealthStore.getState().set({ demoPlaying: false });
  }, []);

  const start = useCallback(() => {
    clear();
    const s = useHealthStore.getState();
    s.setAstronaut('astro-01');
    s.set({ demoPlaying: true, view: 'dashboard', envId: 'mars_transit', whatIfs: [], selectedZone: null, systemFilter: null, layerMode: 'all', highlightZones: [], signalPaused: false, redBannerAt: null });
    s.setDay(45);
    s.log('Demo started: astro-01, days 45 → 53, Mars transit');
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    // day 45 EVA … day 53 CO₂ emergency + solar particle event
    for (let d = 46; d <= 53; d++) at((d - 45) * 5000, () => useHealthStore.getState().setDay(d));
    at(41000, () => useHealthStore.getState().selectZone('lungs'));
    at(48000, () => {
      const st = useHealthStore.getState();
      st.escalate('lungs', 'Lungs & cabin air: ppCO₂ 7.8 mmHg ≥ 7.6 (CO₂ emergency) + solar particle event', envById('mars_transit').delaySec);
    });
    at(60000, () => { useHealthStore.getState().set({ demoPlaying: false }); useHealthStore.getState().log('Demo finished'); });
  }, []);

  useEffect(() => clear, []);
  const toggle = useCallback(() => (useHealthStore.getState().demoPlaying ? stop() : start()), [start, stop]);
  return { start, stop, toggle };
}
