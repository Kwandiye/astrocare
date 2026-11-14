'use client';
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OctagonX, X, Satellite } from 'lucide-react';
import { useHealthStore } from '@/store/useHealthStore';
import { ZONE_IDS, type ZoneId } from '@/types/health';
import { ZONES } from '@/data/zones';
import { fmtDuration, isAutonomous } from '@/lib/commDelay';
import type { useDashboard } from '@/hooks/useDashboard';
import { useLabels } from '@/lib/labels';
import { zoneForFlag } from '@/lib/flagZone';

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.22);
    });
  } catch { /* audio unavailable */ }
}

/** New RED: full-width banner + optional sound (muted by default) + the zone flies into focus. */
export function RedBanner({ d }: { d: ReturnType<typeof useDashboard> }) {
  const redAt = useHealthStore((s) => s.redBannerAt);
  const muted = useHealthStore((s) => s.muted);
  const set = useHealthStore((s) => s.set);
  const selectZone = useHealthStore((s) => s.selectZone);
  const handled = useRef<number | null>(null);
  const critical = d.tick?.activeFlags.filter((f) => f.severity === 'critical') ?? [];
  const zone: ZoneId | null = critical[0] ? zoneForFlag(critical[0]) : ZONE_IDS.find((z) => d.zoneStatus[z] === 'red') ?? null;

  useEffect(() => {
    if (!redAt || handled.current === redAt) return;
    handled.current = redAt;
    if (!muted) beep();
    if (zone && !useHealthStore.getState().demoPlaying) selectZone(zone);
  }, [redAt, muted, zone, selectZone]);

  const show = redAt && d.tick?.alertLevel === 'red';
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          role="alert" className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card bg-crit px-5 py-3.5 text-white">
            <OctagonX className="shrink-0" size={30} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold">Critical alert{zone ? ` — ${ZONES[zone].name.split(' (')[0]}` : ''}</div>
              <div className="text-sm text-white/90">{critical.slice(0, 2).map((f) => f.reason).join(' · ')}</div>
              {d.tick?.doctorRecommendation && <div className="mt-0.5 text-sm font-medium">Action now: {d.tick.doctorRecommendation.split(/(?<=[.!?])\s+/)[0]}</div>}
            </div>
            {zone && <button onClick={() => selectZone(zone)} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-crit hover:bg-red-50">Open protocol</button>}
            <button onClick={() => set({ redBannerAt: null })} aria-label="Dismiss banner" className="rounded-lg p-1.5 hover:bg-white/15"><X size={18} /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AutonomousBanner({ d }: { d: ReturnType<typeof useDashboard> }) {
  const L = useLabels();
  if (!isAutonomous(d.env.delaySec)) return null;
  return (
    <div className="flex items-center gap-2 rounded-card bg-warn/10 px-4 py-2 text-sm text-amber-100">
      <Satellite size={16} className="shrink-0 text-warn" aria-hidden />
      <b>Autonomous mode</b> — {L.mc} is {fmtDuration(d.env.delaySec)} away (one way). Follow on-board protocols; the {L.cmo} leads care, Earth confirms later.
    </div>
  );
}
