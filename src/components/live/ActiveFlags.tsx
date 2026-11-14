'use client';
import { useMemo, useState } from 'react';
import { OctagonX, AlertTriangle, Radiation, BellOff, Check, Bell } from 'lucide-react';
import { useHealthStore } from '@/store/useHealthStore';
import { classifyFlag } from '@/lib/trend';
import { zoneForFlag } from '@/lib/flagZone';
import { ZONES } from '@/data/zones';
import type { BrainTick } from '@/types/brain';
import { Panel } from '@/components/ui/StatusBadge';
import { RAD_COLOR } from '@/lib/status';

/** Active medical alerts — critical first, reason always visible, acknowledge / snooze / show on body. */
export function ActiveFlags({ tick, ticks, stale, max = 4 }: { tick: BrainTick | null; ticks: BrainTick[]; stale: boolean; max?: number }) {
  const acks = useHealthStore((s) => s.acks);
  const ack = useHealthStore((s) => s.ack);
  const selectZone = useHealthStore((s) => s.selectZone);
  const [all, setAll] = useState(false);
  const now = Date.now();

  const flags = useMemo(() => {
    if (!tick) return [];
    const recent = ticks.slice(-30);
    return [...tick.activeFlags]
      .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1))
      .map((f) => {
        const id = f.metric ?? f.reason;
        const inRange = recent.map((t) => !t.activeFlags.some((x) => (x.metric ?? x.reason) === id));
        return { f, id, kind: classifyFlag(inRange) };
      });
  }, [tick, ticks]);

  return (
    <Panel title={<>Active alerts <span className="rounded-full bg-raised px-2 py-0.5 text-xs font-medium text-muted num">{flags.length}</span></>}
      icon={<Bell size={16} className="text-muted" aria-hidden />} className={stale ? 'opacity-60 grayscale' : ''} pad={false}>
      <ul id="alerts" className="max-h-[300px] space-y-2 overflow-y-auto px-4 pb-4 pt-2 scroll-thin">
        {flags.length === 0 && <li className="rounded-xl bg-ok/10 px-3 py-3 text-sm text-ok">No active alerts. All parameters are within the normal range.</li>}
        {flags.slice(0, all ? flags.length : max).map(({ f, id, kind }) => {
          const crit = f.severity === 'critical';
          const color = f.type === 'radiation' ? RAD_COLOR : crit ? '#EF4444' : '#F59E0B';
          const Icon = f.type === 'radiation' ? Radiation : crit ? OctagonX : AlertTriangle;
          const key = `${tick?.astronautId}:${tick?.missionDay}:${id}`;
          const a = acks[key];
          const snoozed = a?.snoozeUntil && a.snoozeUntil > now;
          const zone = zoneForFlag(f);
          return (
            <li key={id} className="rounded-xl bg-raised/60 p-3" style={{ opacity: snoozed ? 0.55 : 1, boxShadow: `inset 3px 0 0 ${color}` }}>
              <div className="flex items-start gap-2.5">
                <Icon size={18} color={color} className="mt-0.5 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-ink">{f.reason}</p>
                  <div className="mt-0.5 text-xs text-muted">
                    <span style={{ color }}>{crit ? 'Critical' : 'Warning'}</span> · {kind === 'sustained' ? 'ongoing' : 'brief spike'}
                    {f.deviationPct != null && <> · {f.deviationPct > 0 ? '+' : ''}{f.deviationPct}% vs your baseline</>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <button onClick={() => selectZone(zone)} className="rounded-lg bg-card px-2.5 py-1 text-slate-200 hover:bg-canvas">Show {ZONES[zone].name.split(' (')[0].toLowerCase()}</button>
                    {!a && <button onClick={() => ack(key)} className="flex items-center gap-1 rounded-lg bg-card px-2.5 py-1 text-slate-200 hover:bg-canvas"><Check size={12} />Acknowledge</button>}
                    {a && !snoozed && <span className="px-1 py-1 text-ok">Acknowledged</span>}
                    {!crit && !snoozed && <button onClick={() => ack(key, 15)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-muted hover:bg-card"><BellOff size={12} />Snooze 15 min</button>}
                    {snoozed && <span className="px-1 py-1 text-muted">Snoozed</span>}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {flags.length > max && <li><button onClick={() => setAll(!all)} className="px-1 text-xs font-medium text-info hover:underline">{all ? 'Show fewer' : `Show all ${flags.length} alerts`}</button></li>}
      </ul>
    </Panel>
  );
}
