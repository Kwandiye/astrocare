'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Satellite, Radio, Volume2, VolumeX, ClipboardPlus, FlaskConical, Play, Square, Globe2,
  MoreHorizontal, Users, BookOpen, ChevronDown, Check,
} from 'lucide-react';
import { useHealthStore, type View } from '@/store/useHealthStore';
import { ASTRONAUTS, MISSION_DAYS } from '@/data/astronauts';
import { getLog, getHistory } from '@/data/generator';
import { triage, worst } from '@/lib/triageEngine';
import { ENVIRONMENTS, envById, type EnvironmentId } from '@/lib/environments';
import { fmtDuration } from '@/lib/commDelay';
import { StatusDot } from '@/components/ui/StatusBadge';
import { STATUS_META } from '@/lib/status';
import { applyEnvironment } from '@/lib/simulator';

const TABS: { id: View; label: string }[] = [
  { id: 'dashboard', label: 'Overview' }, { id: 'analytics', label: 'Health Analytics' }, { id: 'assistant', label: 'AI Assistant' },
  { id: 'training', label: 'Training & Recovery' }, { id: 'history', label: 'Mission History' },
];

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open, close]);
  return ref;
}

export function TopBar({ onDemo }: { onDemo: () => void }) {
  const s = useHealthStore();
  const env = envById(s.envId);
  const [crewOpen, setCrewOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const crewRef = useOutside(crewOpen, () => setCrewOpen(false));
  const moreRef = useOutside(moreOpen, () => setMoreOpen(false));

  const crewStatus = useMemo(() => Object.fromEntries(ASTRONAUTS.map((a) => {
    const l = applyEnvironment(getLog(a.id, s.day), s.envId);
    return [a.id, triage(a, l, getHistory(a.id, s.day)).overall];
  })), [s.day, s.envId]);
  const missionStatus = worst(...ASTRONAUTS.map((a) => crewStatus[a.id]));
  const me = ASTRONAUTS.find((a) => a.id === s.astronautId)!;
  const remote = env.delaySec > 60;
  const go = (view: View) => { s.set({ view }); setMoreOpen(false); };

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
      <div className="mx-auto flex h-14 max-w-[1680px] items-center gap-3 px-4">
        {/* brand + mission */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/15 text-info"><Satellite size={18} aria-hidden /></div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-ink">AstroCare</div>
            <div className="text-[11px] text-muted">Mission AX-26</div>
          </div>
        </div>

        {/* mission day */}
        <div className="ml-1 hidden items-center rounded-lg bg-card px-1 py-1 sm:flex" aria-label="Mission day">
          <button className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink" onClick={() => s.setDay(s.day - 1)} aria-label="Previous day"><ChevronLeft size={16} /></button>
          <div className="whitespace-nowrap px-1.5 text-center text-sm font-semibold text-ink num">Day {s.day}<span className="font-normal text-muted"> / {MISSION_DAYS}</span></div>
          <button className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink" onClick={() => s.setDay(s.day + 1)} aria-label="Next day"><ChevronRight size={16} /></button>
        </div>

        {/* mission status + comm delay */}
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: STATUS_META[missionStatus].bg, color: STATUS_META[missionStatus].color }}
            title={`Mission status: worst status across the crew (${STATUS_META[missionStatus].label})`}>
            <StatusDot status={missionStatus} /><span className="hidden 2xl:inline">Crew {missionStatus === 'green' ? 'nominal' : missionStatus === 'red' ? 'critical' : 'attention'}</span>
          </span>
          <span className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${remote ? 'bg-warn/15 text-warn' : 'bg-card text-muted'}`}
            title={`One-way signal delay to Earth · ${env.label}`}>
            <Radio size={13} aria-label="Earth delay" /><span className="hidden 2xl:inline">Earth delay</span> {fmtDuration(env.delaySec)}
          </span>
        </div>

        {/* tabs */}
        <nav className="mx-auto hidden h-full items-stretch gap-1 xl:flex" aria-label="Main">
          {TABS.map((t) => {
            const on = s.view === t.id || (t.id === 'training' && s.view === 'routine') || (t.id === 'analytics' && s.view === 'radar');
            return (
              <button key={t.id} onClick={() => go(t.id)} aria-current={on ? 'page' : undefined}
                className={`relative whitespace-nowrap px-2.5 text-sm font-medium transition-colors ${on ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                {t.label}
                {on && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-info" />}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 xl:ml-0">
          <button onClick={() => s.set({ checkinOpen: true })} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-info px-3 py-1.5 text-sm font-semibold text-canvas hover:bg-sky-300">
            <ClipboardPlus size={15} aria-hidden /><span className="hidden sm:inline">Check-in</span>
          </button>
          {s.demoPlaying && (
            <button onClick={onDemo} className="flex items-center gap-1 rounded-lg bg-crit/15 px-2.5 py-1.5 text-xs font-semibold text-crit"><Square size={12} /> Stop demo</button>
          )}

          {/* more menu */}
          <div className="relative" ref={moreRef}>
            <button onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen} aria-label="More tools" className="rounded-lg p-2 text-muted hover:bg-card hover:text-ink"><MoreHorizontal size={18} /></button>
            {moreOpen && (
              <div className="absolute right-0 top-11 z-40 w-72 rounded-xl border border-white/10 bg-raised p-2 text-sm shadow-2xl">
                <label className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                  <Globe2 size={15} className="text-muted" aria-hidden />
                  <span className="text-muted">Location</span>
                  <select value={s.envId} onChange={(e) => s.set({ envId: e.target.value as EnvironmentId })}
                    className="ml-auto max-w-[150px] rounded-md bg-card px-2 py-1 text-xs text-ink ring-1 ring-white/10" aria-label="Mission environment">
                    {ENVIRONMENTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </label>
                <MenuItem icon={<Play size={15} />} onClick={() => { onDemo(); setMoreOpen(false); }}>{s.demoPlaying ? 'Stop 60-s demo' : 'Play 60-s demo scenario'}</MenuItem>
                <MenuItem icon={<FlaskConical size={15} />} onClick={() => { s.set({ whatIfOpen: !s.whatIfOpen }); setMoreOpen(false); }}>What-if simulator</MenuItem>
                <MenuItem icon={<Users size={15} />} onClick={() => go('crew')}>Crew overview (flight surgeon)</MenuItem>
                <MenuItem icon={<BookOpen size={15} />} onClick={() => go('learn')}>Learn & glossary</MenuItem>
                <div className="my-1 h-px bg-white/10" />
                <MenuItem icon={s.muted ? <VolumeX size={15} /> : <Volume2 size={15} />} onClick={() => s.set({ muted: !s.muted })}>{s.muted ? 'Critical alert sound: off' : 'Critical alert sound: on'}</MenuItem>
                <MenuItem icon={<Globe2 size={15} />} onClick={() => s.set({ earthMode: !s.earthMode })}>Earth mode (telemedicine) {s.earthMode && <Check size={14} className="ml-auto text-ok" />}</MenuItem>
              </div>
            )}
          </div>

          {/* astronaut switcher */}
          <div className="relative" ref={crewRef}>
            <button onClick={() => setCrewOpen(!crewOpen)} aria-expanded={crewOpen} aria-label="Switch astronaut"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-card">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${me.color}26`, color: me.color }}>
                {me.initials}
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-canvas"><StatusDot status={crewStatus[me.id]} size={10} /></span>
              </span>
              <span className="hidden whitespace-nowrap text-left leading-tight md:block">
                <span className="block text-[13px] font-medium text-ink">{me.name}</span>
                <span className="block text-[11px] text-muted">{me.role}</span>
              </span>
              <ChevronDown size={14} className="text-muted" />
            </button>
            {crewOpen && (
              <div className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-white/10 bg-raised p-1.5 shadow-2xl" role="listbox" aria-label="Crew">
                {ASTRONAUTS.map((a) => (
                  <button key={a.id} role="option" aria-selected={a.id === s.astronautId} onClick={() => { s.setAstronaut(a.id); setCrewOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-card ${a.id === s.astronautId ? 'bg-card' : ''}`}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${a.color}26`, color: a.color }}>{a.initials}</span>
                    <span className="flex-1 leading-tight">
                      <span className="block text-sm text-ink">{a.name}</span>
                      <span className="block text-[11px] text-muted">{a.role}</span>
                    </span>
                    <span className="text-[11px] font-medium" style={{ color: STATUS_META[crewStatus[a.id]].color }}>{STATUS_META[crewStatus[a.id]].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* tabs on smaller screens */}
      <nav className="flex gap-1 overflow-x-auto border-t border-white/[0.04] px-3 py-1.5 scroll-thin xl:hidden" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => go(t.id)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${s.view === t.id ? 'bg-card text-ink' : 'text-muted'}`}>{t.label}</button>
        ))}
      </nav>
    </header>
  );
}

function MenuItem({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-200 hover:bg-card">
      <span className="text-muted">{icon}</span>{children}
    </button>
  );
}
