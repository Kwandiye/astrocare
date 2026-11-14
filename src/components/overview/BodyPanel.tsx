'use client';
import dynamic from 'next/dynamic';
import { RotateCcw, Layers, ChevronDown } from 'lucide-react';
import { useHealthStore, type LayerMode } from '@/store/useHealthStore';
import { STATUS_META } from '@/lib/status';
import { SYSTEM_IDS, ZONE_IDS, type SystemId, type TriageStatus, type ZoneId } from '@/types/health';
import { SYSTEM_LABEL, ZONES } from '@/data/zones';
import { STATUS_RANK } from '@/lib/triageEngine';
import type { useDashboard } from '@/hooks/useDashboard';

const Twin3D = dynamic(() => import('@/components/twin/Twin3D').then((m) => m.Twin3D), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted">Loading 3D body…</div>,
});

const LAYERS: { id: LayerMode; label: string }[] = [
  { id: 'all', label: 'Organs (X-ray)' }, { id: 'skin', label: 'Skin' }, { id: 'muscles', label: 'Muscles' },
  { id: 'organs', label: 'Organs only' }, { id: 'skeleton', label: 'Skeleton' },
];

/** Interactive 3D body: abnormal organs are highlighted; click an organ for its health details. */
export function BodyPanel({ d, className = '' }: { d: ReturnType<typeof useDashboard>; className?: string }) {
  const layerMode = useHealthStore((s) => s.layerMode);
  const side = useHealthStore((s) => s.viewSide);
  const filter = useHealthStore((s) => s.systemFilter);
  const painPick = useHealthStore((s) => s.painPick);
  const highlight = useHealthStore((s) => s.highlightZones);
  const selectZone = useHealthStore((s) => s.selectZone);
  const set = useHealthStore((s) => s.set);
  const abnormal = ZONE_IDS.filter((z) => d.zoneStatus[z] === 'yellow' || d.zoneStatus[z] === 'red')
    .sort((a, b) => STATUS_RANK[d.zoneStatus[b]] - STATUS_RANK[d.zoneStatus[a]]);

  return (
    <section className={`card relative flex flex-col overflow-hidden rounded-card ${painPick ? 'ring-2 ring-warn' : ''} ${className}`} aria-label="3D body map">
      <div className="relative min-h-[420px] flex-1">
        {/* the canvas fills the whole panel; title, legend and quick-jump chips float over it */}
        <div className="absolute inset-0"><Twin3D zoneStatus={d.zoneStatus} zones={d.result.zones} sky={d.env.sky} /></div>
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-4 pt-3.5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Body map</h2>
            <p className="text-xs text-muted">Click an organ · drag to rotate · scroll to zoom</p>
            {abnormal.length > 0 && (
              <div className="pointer-events-auto mt-2.5 flex flex-col items-start gap-1.5">
                {abnormal.slice(0, 5).map((z) => {
                  const m = STATUS_META[d.zoneStatus[z]];
                  return (
                    <button key={z} onClick={() => selectZone(z)} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur hover:brightness-125" style={{ background: m.bg, color: m.color }}>
                      <m.icon size={12} />{ZONES[z].name.split(' (')[0]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 text-xs text-muted" aria-label="Legend">
            {(['green', 'yellow', 'red', 'stale'] as TriageStatus[]).map((s) => (
              <span key={s} className="flex items-center gap-1.5">{STATUS_META[s].label}<span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[s].color }} /></span>
            ))}
          </div>
        </header>
        {painPick && <div className="pointer-events-none absolute left-1/2 top-14 z-10 -translate-x-1/2 rounded-full bg-warn px-3 py-1 text-sm font-semibold text-canvas">Where does it hurt? Click the body</div>}
        {highlight.length > 0 && (
          <button onClick={() => set({ highlightZones: [] })} className="absolute bottom-3 left-3 z-10 rounded-lg bg-raised px-2.5 py-1 text-xs text-slate-200">Clear risk highlight</button>
        )}
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-3 py-2.5">
        <div className="inline-flex rounded-lg bg-raised p-0.5 text-xs" role="radiogroup" aria-label="View side">
          {(['front', 'back'] as const).map((s) => (
            <button key={s} role="radio" aria-checked={side === s} onClick={() => set({ viewSide: s, selectedZone: null })}
              className={`rounded-md px-3 py-1 font-medium capitalize ${side === s ? 'bg-card text-ink shadow' : 'text-muted hover:text-ink'}`}>{s}</button>
          ))}
        </div>
        <label className="relative flex items-center gap-1.5 rounded-lg bg-raised px-2 py-1 text-xs text-slate-200">
          <Layers size={14} className="text-muted" aria-hidden />
          <select value={layerMode} onChange={(e) => set({ layerMode: e.target.value as LayerMode, selectedZone: null })}
            className="appearance-none bg-transparent pr-4 outline-none" aria-label="Anatomy layer">
            {LAYERS.map((l) => <option key={l.id} value={l.id} className="bg-raised">{l.label}</option>)}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 text-muted" />
        </label>
        <label className="relative flex items-center rounded-lg bg-raised px-2 py-1 text-xs text-slate-200">
          <select value={filter ?? ''} onChange={(e) => set({ systemFilter: (e.target.value || null) as SystemId | null })}
            className="appearance-none bg-transparent pr-4 outline-none" aria-label="Filter by body system">
            <option value="" className="bg-raised">All body systems</option>
            {SYSTEM_IDS.map((s) => <option key={s} value={s} className="bg-raised">{SYSTEM_LABEL[s]}</option>)}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 text-muted" />
        </label>
        <button onClick={() => set({ selectedZone: null, viewSide: 'front', layerMode: 'all', systemFilter: null, highlightZones: [] })}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-raised hover:text-ink" title="Reset view">
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      {/* accessible list of all zones */}
      <details className="border-t border-white/[0.06] px-4 py-2 text-xs">
        <summary className="cursor-pointer select-none text-muted hover:text-ink">All 16 body zones (list view)</summary>
        <ul className="mt-2 grid grid-cols-2 gap-1">
          {[...ZONE_IDS].sort((a, b) => STATUS_RANK[d.zoneStatus[b]] - STATUS_RANK[d.zoneStatus[a]]).map((z: ZoneId) => (
            <li key={z}>
              <button onClick={() => selectZone(z)} className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-slate-300 hover:bg-raised">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_META[d.zoneStatus[z]].color }} />
                <span className="truncate">{ZONES[z].name}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
