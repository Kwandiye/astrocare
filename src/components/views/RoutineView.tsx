'use client';
import { useMemo } from 'react';
import { Bell, CheckCircle2, Circle, XCircle, Trophy, Flame, Users, Award } from 'lucide-react';
import { useHealthStore } from '@/store/useHealthStore';
import { useDashboard, useNow } from '@/hooks/useDashboard';
import { getMissionSeries } from '@/data/generator';
import { ASTRONAUTS, astronautById } from '@/data/astronauts';
import { recovery } from '@/lib/scores';

interface Task { id: string; title: string; hour: number; min: number; howTo: string; weekly?: boolean }
const TASKS: Task[] = [
  { id: 'bp', title: 'Blood pressure + heart rate', hour: 7, min: 2, howTo: 'Feet in foot loops, arm at heart level, rest 5 min, cuff on bare arm. Do not talk.' },
  { id: 'glucose', title: 'Pre-breakfast glucose', hour: 7, min: 2, howTo: 'Wash & dry finger, use the side of the fingertip, capture the drop before it floats away.' },
  { id: 'questionnaire', title: 'Post-sleep questionnaire', hour: 8, min: 1, howTo: 'Daily check-in: mood, sleep hours, symptoms, pain map.' },
  { id: 'pvt', title: 'PVT-B cognitive test', hour: 9, min: 3, howTo: 'Tablet reaction test: tap when the counter appears. Quiet place, same time daily.' },
  { id: 'exercise', title: 'Exercise: treadmill + ARED', hour: 14, min: 120, howTo: 'Harness load ≥ 70% body weight on treadmill; ARED squats, deadlifts, heel raises.' },
  { id: 'eye', title: 'Weekly eye check (SANS)', hour: 16, min: 15, weekly: true, howTo: 'Amsler grid + tonometry; OCT if scheduled. Note any blurred near vision.' },
];

/** Mission routine & reminders, data confidence and gamification (never for symptoms). */
export function RoutineView() {
  const d = useDashboard();
  const tasksDone = useHealthStore((s) => s.tasksDone);
  const complete = useHealthStore((s) => s.completeTask);
  const xp = useHealthStore((s) => s.xp);
  const now = useNow(30000);
  const hour = new Date(now).getUTCHours();
  const key = (id: string) => `${d.astronaut.id}:${d.log.missionDay}:${id}`;
  const todays = TASKS.filter((t) => !t.weekly || d.log.missionDay % 7 === 0);
  const status = (t: Task) => (tasksDone[key(t.id)] || (t.id === 'exercise' && d.log.exerciseMinutes >= 90) ? 'done' : hour >= t.hour + 2 ? 'missed' : hour >= t.hour ? 'due' : 'later');
  const dueSoFar = todays.filter((t) => status(t) !== 'later');
  const confidence = dueSoFar.length ? Math.round((dueSoFar.filter((t) => status(t) === 'done').length / dueSoFar.length) * 100) : 100;
  const next = todays.find((t) => status(t) === 'due');

  const streaks = useMemo(() => {
    const s = getMissionSeries(d.astronaut.id).slice(0, d.log.missionDay + 1).reverse();
    const run = (ok: (i: number) => boolean) => { let n = 0; for (let i = 0; i < s.length && ok(i); i++) n++; return n; };
    return {
      exercise: run((i) => s[i].exerciseMinutes >= 90),
      sleep: run((i) => s[i].sleepHours >= 6),
      measure: run((i) => !s[i].events.includes('skipped_exercise')),
    };
  }, [d.astronaut.id, d.log.missionDay]);

  const team = useMemo(() => Math.round(ASTRONAUTS.reduce((acc, a) => acc + recovery(astronautById(a.id), getMissionSeries(a.id)[d.log.missionDay]).value, 0) / ASTRONAUTS.length), [d.log.missionDay]);
  const badges = [
    { name: '7-day sleep champion', got: streaks.sleep >= 7 },
    { name: 'Bone guardian (14-day exercise)', got: streaks.exercise >= 14 },
    { name: 'Protocol pro (50 XP)', got: xp >= 50 },
    { name: 'Data hawk (100% confidence)', got: confidence === 100 },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="glass rounded-xl p-4">
        <h1 className="text-lg font-bold">Daily measurement routine <span className="text-sm font-normal text-slate-400">· Day {d.log.missionDay} · {d.astronaut.name}</span></h1>
        {next && (
          <div className="mt-3 flex items-start gap-3 rounded-lg border border-sky-400/40 bg-sky-500/10 p-3">
            <Bell className="mt-0.5 text-sky-300" size={18} />
            <div className="flex-1">
              <div className="font-semibold">Time to measure: {next.title} — {next.min} min</div>
              <div className="text-sm text-slate-300">How to: {next.howTo}</div>
            </div>
            <button onClick={() => complete(next.id)} className="rounded-md bg-sky-500/25 px-3 py-1 text-sm font-semibold">Done</button>
          </div>
        )}
        <ol className="mt-3 space-y-1.5">
          {todays.map((t) => {
            const st = status(t);
            const I = st === 'done' ? CheckCircle2 : st === 'missed' ? XCircle : Circle;
            const c = st === 'done' ? 'text-emerald-400' : st === 'missed' ? 'text-red-400' : st === 'due' ? 'text-sky-300' : 'text-slate-500';
            return (
              <li key={t.id} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-slate-800/50">
                <span className="num w-12 pt-0.5 text-xs text-slate-400">{String(t.hour).padStart(2, '0')}:00</span>
                <I size={18} className={c} aria-label={st} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.title} <span className="text-xs text-slate-500">· {t.min} min{t.weekly ? ' · weekly' : ''}</span></div>
                  <div className="text-xs text-slate-400">{t.howTo}</div>
                </div>
                {st !== 'done' && <button onClick={() => complete(t.id)} className="rounded bg-slate-800 px-2 py-0.5 text-xs hover:bg-slate-700">Mark done</button>}
              </li>
            );
          })}
        </ol>
        <div className="mt-4">
          <div className="flex justify-between text-xs"><span className="text-slate-400">Data confidence</span><b className="num">{confidence}%</b></div>
          <div className="mt-1 h-2 rounded bg-slate-800"><div className="h-full rounded" style={{ width: `${confidence}%`, background: confidence >= 80 ? '#22C55E' : confidence >= 50 ? '#F59E0B' : '#EF4444' }} /></div>
          <p className="mt-1 text-[11px] text-slate-500">Missed measurements lower confidence — triage then relies on older data.</p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="glass rounded-xl p-4">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Flame size={14} /> Streaks</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Exercise', streaks.exercise], ['Sleep ≥ 6 h', streaks.sleep], ['Routine', streaks.measure]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-slate-900/60 p-2"><div className="num text-2xl font-bold text-orange-300">{v}</div><div className="text-[11px] text-slate-400">{l} days</div></div>
            ))}
          </div>
        </div>
        <div className="glass rounded-xl p-4">
          <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Trophy size={14} /> XP & badges</h2>
          <div className="num mb-2 text-xl font-bold text-amber-300">{xp} XP</div>
          <ul className="space-y-1 text-sm">{badges.map((b) => <li key={b.name} className={`flex items-center gap-2 ${b.got ? 'text-amber-200' : 'text-slate-500'}`}><Award size={15} />{b.name}{b.got ? '' : ' (locked)'}</li>)}</ul>
          <p className="mt-2 text-[11px] text-slate-500">XP for routines and completed protocols. Symptoms are never gamified.</p>
        </div>
        <div className="glass rounded-xl p-4">
          <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><Users size={14} /> Crew challenge</h2>
          <div className="text-sm">Team recovery score: <b className="num text-sky-200">{team}%</b></div>
          <p className="text-[11px] text-slate-500">Shared goal: average crew recovery ≥ 70% for 5 days (supports the HRP teamwork risk).</p>
        </div>
      </section>
    </div>
  );
}
