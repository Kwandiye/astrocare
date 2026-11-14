'use client';
import { useHealthStore } from '@/store/useHealthStore';
import { RedBanner, AutonomousBanner } from '@/components/alerts/Alerts';
import { ActiveFlags } from '@/components/live/ActiveFlags';
import { HealthHero } from './HealthHero';
import { VitalGrid } from './VitalGrid';
import { BodyPanel } from './BodyPanel';
import { NextActions } from './NextActions';
import { CabinPanel } from './CabinPanel';
import type { useDashboard } from '@/hooks/useDashboard';

/**
 * Overview, in priority order: 1 critical alert · 2 overall status · 3 vital signs · 4 3D body ·
 * 5 next actions & alerts · 6 spacecraft environment. Detailed history lives in Health Analytics.
 */
export function Overview({ d }: { d: ReturnType<typeof useDashboard> }) {
  const ticks = useHealthStore((s) => s.ticks);
  return (
    <div className="space-y-4">
      <RedBanner d={d} />
      <HealthHero d={d} />
      <AutonomousBanner d={d} />
      {/* half the width for the 3D body, half for the indicators */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="order-2 xl:order-1">
          <BodyPanel d={d} className="h-[680px] xl:sticky xl:top-[72px] xl:h-[calc(100vh-222px)] xl:max-h-[980px] xl:min-h-[600px]" />
        </div>
        <div className="order-1 min-w-0 space-y-4 xl:order-2">
          <VitalGrid d={d} />
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <NextActions d={d} />
            <ActiveFlags tick={d.tick} ticks={ticks} stale={d.fresh.state === 'lost'} />
          </div>
        </div>
      </div>
      <CabinPanel d={d} />
    </div>
  );
}
