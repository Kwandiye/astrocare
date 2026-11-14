'use client';
import { useMemo } from 'react';
import { useHealthStore } from '@/store/useHealthStore';
import { ASTRONAUTS } from '@/data/astronauts';
import { effectiveLog, effectiveHistory } from '@/lib/simulator';
import { triage, STATUS_RANK } from '@/lib/triageEngine';
import { recovery } from '@/lib/scores';
import { Twin2D } from '@/components/twin/Twin2D';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ZONE_IDS } from '@/types/health';
import { useLabels } from '@/lib/labels';

/** Flight-surgeon view: 4 twins side by side, sorted by severity. */
export function CrewView() {
  const day = useHealthStore((s) => s.day);
  const envId = useHealthStore((s) => s.envId);
  const overrides = useHealthStore((s) => s.overrides);
  const set = useHealthStore((s) => s.set);
  const setAstronaut = useHealthStore((s) => s.setAstronaut);
  const L = useLabels();

  const crew = useMemo(() => ASTRONAUTS.map((a) => {
    const log = effectiveLog(a.id, day, envId, overrides[`${a.id}:${day}`]);
    const t = triage(a, log, effectiveHistory(a.id, day, envId));
    const zs = Object.fromEntries(ZONE_IDS.map((z) => [z, t.zones[z].status])) as Record<(typeof ZONE_IDS)[number], typeof t.overall>;
    return { a, t, zs, rec: recovery(a, log), drivers: Array.from(new Set(ZONE_IDS.flatMap((z) => t.zones[z].drivers))).slice(0, 3) };
  }).sort((x, y) => STATUS_RANK[y.t.overall] - STATUS_RANK[x.t.overall] || x.rec.value - y.rec.value), [day, envId, overrides]);

  return (
    <div>
      <h1 className="mb-3 text-lg font-bold">{L.crew} overview · Day {day} <span className="text-sm font-normal text-slate-400">sorted by severity ({L.surgeon} view)</span></h1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {crew.map(({ a, t, zs, rec, drivers }) => (
          <article key={a.id} className="glass flex flex-col rounded-xl p-3">
            <header className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold" style={{ color: a.color }}>{a.name}</div>
                <div className="text-xs text-slate-400">{a.role} · age {a.age}</div>
              </div>
              <StatusBadge status={t.overall} size="md" />
            </header>
            <div className="mx-auto my-2 h-56 w-32"><Twin2D zoneStatus={zs} compact /></div>
            <div className="mb-2 flex justify-between text-xs">
              <span>Recovery <b className="num">{rec.value}%</b></span>
              <span>MFI <b className="num">{t.mfi}</b></span>
              <span>Syndromes <b className="num">{t.syndromes.length}</b></span>
            </div>
            <ul className="mb-2 flex-1 space-y-1 text-xs text-slate-300">
              {drivers.length === 0 ? <li className="text-emerald-300">All zones nominal.</li> : drivers.map((d) => <li key={d} className="line-clamp-2">• {d}</li>)}
            </ul>
            <p className="mb-2 text-[11px] text-slate-500">{a.story}</p>
            <button onClick={() => { setAstronaut(a.id); set({ view: 'dashboard' }); }} className="rounded-md bg-sky-500/20 py-1.5 text-sm font-semibold text-sky-200 hover:bg-sky-500/30">Open 3D twin</button>
          </article>
        ))}
      </div>
    </div>
  );
}
