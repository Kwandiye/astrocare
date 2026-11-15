'use client';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ScrollText, Send, Users, ArrowRight } from 'lucide-react';
import { useHealthStore } from '@/store/useHealthStore';
import { triage } from '@/lib/triageEngine';
import { STATUS_META } from '@/lib/status';
import { MISSION_DAYS } from '@/data/astronauts';
import { useMission } from '@/hooks/useMission';
import type { MissionEventType, TriageStatus } from '@/types/health';
import type { useDashboard } from '@/hooks/useDashboard';
import { getReport, type MissionReport } from '@/lib/brainHttp';

const EVENT: Record<MissionEventType, string> = {
  eva: 'Spacewalk (EVA)', spe: 'Solar particle event', cdra_failure: 'CO₂ scrubber failure', circadian_shift: 'Sleep shift (slam shift)',
  skipped_exercise: 'Skipped exercise', sans_exam: 'Eye exam (SANS)',
};

export function HistoryView({ d }: { d: ReturnType<typeof useDashboard> }) {
  const day = useHealthStore((s) => s.day);
  const setDay = useHealthStore((s) => s.setDay);
  const audit = useHealthStore((s) => s.audit);
  const escalations = useHealthStore((s) => s.escalations);
  const set = useHealthStore((s) => s.set);
  const mission = useMission(d);
  const [brainReport, setBrainReport] = useState<MissionReport | null>(null);
  const live = d.tick?.doctorSource || d.tick?.bodySystems;

  useEffect(() => {
    if (!live || !d.tick?.astronautId) return;
    getReport(d.tick.astronautId).then(setBrainReport).catch(() => setBrainReport(null));
  }, [live, d.tick?.astronautId]);

  const days = useMemo(() => mission.map((l, i) => ({ log: l, status: triage(d.astronaut, l, mission.slice(Math.max(0, i - 7), i)).overall as TriageStatus })), [mission, d.astronaut]);
  const counts = days.slice(0, day + 1).reduce((a, x) => ({ ...a, [x.status]: (a[x.status] ?? 0) + 1 }), {} as Record<string, number>);
  const events = days.slice(0, day + 1).filter((x) => x.log.events.length || x.status === 'red').reverse();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Mission history</h1>
          <p className="text-sm text-muted">{d.astronaut.name} · day {day} of {MISSION_DAYS} · click any day to review it</p>
        </div>
        <button onClick={() => set({ view: 'crew' })} className="flex items-center gap-1.5 rounded-lg bg-card px-3 py-2 text-sm text-ink hover:bg-raised"><Users size={15} />Crew overview <ArrowRight size={14} /></button>
      </div>

      <section className="card rounded-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><CalendarDays size={18} className="text-muted" />Daily health status</h2>
          <div className="flex gap-4 text-xs text-muted">
            {(['green', 'yellow', 'red'] as const).map((s) => <span key={s} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_META[s].color }} />{STATUS_META[s].label}: <b className="num text-slate-200">{counts[s] ?? 0}</b> days</span>)}
          </div>
        </div>
        <div className="mt-4 flex h-10 w-full gap-px overflow-hidden rounded-lg" role="list" aria-label="Status by mission day">
          {days.map(({ log, status }) => {
            const future = log.missionDay > day;
            return (
              <button key={log.missionDay} role="listitem" onClick={() => setDay(log.missionDay)}
                title={`Day ${log.missionDay}: ${STATUS_META[status].label}${log.events.length ? ' · ' + log.events.map((e) => EVENT[e]).join(', ') : ''}`}
                className="relative h-full flex-1 transition-opacity hover:opacity-100" aria-label={`Day ${log.missionDay} ${STATUS_META[status].label}`}
                style={{ background: future ? '#1B2738' : STATUS_META[status].color, opacity: log.missionDay === day ? 1 : future ? 1 : status === 'green' ? 0.45 : 0.85 }}>
                {log.missionDay === day && <span className="absolute inset-0 ring-2 ring-inset ring-white" />}
              </button>
            );
          })}
        </div>
        <div className="num mt-1.5 flex justify-between text-xs text-muted"><span>Day 0</span><span>Day 90</span><span>Day {MISSION_DAYS}</span></div>
      </section>

      {brainReport && (
        <section className="card rounded-card p-5" aria-label="Brain mission report">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">Brain mission report</h2>
            <span className="text-xs text-muted">EMCL/IMM vocabulary</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(['green', 'yellow', 'red'] as const).map((level) => <div key={level} className="rounded-xl bg-raised/60 p-3"><div className="text-xs capitalize text-muted">{level}</div><div className="num mt-1 text-xl text-ink">{Math.round(brainReport.timeByLevel[level] / 60)} min</div></div>)}
          </div>
          {brainReport.conditionsSeen.length > 0 && <div className="mt-3 text-sm text-slate-300">Conditions seen: {brainReport.conditionsSeen.map((condition) => `${condition.code} (${condition.episodes})`).join(' · ')}</div>}
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="card rounded-card p-5">
          <h2 className="text-base font-semibold text-ink">Events & critical days</h2>
          <ol className="mt-3 max-h-[440px] space-y-2 overflow-y-auto pr-1 scroll-thin">
            {events.length === 0 && <li className="text-sm text-muted">No notable events so far.</li>}
            {events.map(({ log, status }) => (
              <li key={log.missionDay}>
                <button onClick={() => setDay(log.missionDay)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-raised ${log.missionDay === day ? 'bg-raised' : 'bg-raised/40'}`}>
                  <span className="num w-16 shrink-0 text-sm font-semibold text-ink">Day {log.missionDay}</span>
                  <span className="flex-1 text-sm text-slate-300">{log.events.length ? log.events.map((e) => EVENT[e]).join(' · ') : 'Critical status'}</span>
                  <span className="text-xs font-medium" style={{ color: STATUS_META[status].color }}>{STATUS_META[status].label}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-4">
          <section className="card rounded-card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><Send size={17} className="text-muted" />Reports to Mission Control</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {escalations.length === 0 && <li className="text-muted">No reports sent this session.</li>}
              {escalations.map((e) => (
                <li key={e.id} className="rounded-xl bg-raised/50 p-3">
                  <div className="num text-xs text-muted">{new Date(e.at).toISOString().slice(11, 19)} UTC</div>
                  <div className="text-slate-200">{e.text}</div>
                </li>
              ))}
            </ul>
          </section>
          <section className="card rounded-card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><ScrollText size={17} className="text-muted" />Activity log</h2>
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-sm scroll-thin">
              {audit.length === 0 && <li className="text-muted">No events yet.</li>}
              {audit.slice(0, 60).map((a, i) => (
                <li key={i} className="flex gap-3"><span className="num shrink-0 text-xs leading-5 text-muted">{new Date(a.at).toISOString().slice(11, 19)}</span><span className="text-slate-300">{a.text}</span></li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
