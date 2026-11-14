'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Hand, Save } from 'lucide-react';
import { useHealthStore } from '@/store/useHealthStore';
import { ZONE_IDS, type ZoneId } from '@/types/health';
import { ZONES } from '@/data/zones';
import { CameraHR } from './CameraHR';
import type { DailyTelemetryLog } from '@/types/health';

const MOODS = [{ v: 1, e: '😣', l: 'Very bad' }, { v: 2, e: '🙁', l: 'Bad' }, { v: 3, e: '😐', l: 'OK' }, { v: 4, e: '🙂', l: 'Good' }, { v: 5, e: '😄', l: 'Great' }];

type Field = { key: 'sbp' | 'dbp' | 'glucose' | 'coreTemp'; label: string; unit: string; min: number; max: number; warnLo: number; warnHi: number };

/** Daily check-in wizard (≤ 60 s): mood, sleep, manual vitals with plausibility checks, pain by clicking the body, camera HR. */
export function CheckIn() {
  const set = useHealthStore((s) => s.set);
  const setOverride = useHealthStore((s) => s.setOverride);
  const completeTask = useHealthStore((s) => s.completeTask);
  const pendingPain = useHealthStore((s) => s.pendingPainZone);
  const unit = useHealthStore((s) => s.glucoseUnit);
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<number | null>(null);
  const [sleep, setSleep] = useState(6.5);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [pain, setPain] = useState<Partial<Record<ZoneId, number>>>({});
  const [camHr, setCamHr] = useState<number | null>(null);

  const g = unit === 'mg/dL' ? { min: 20, max: 600, warnLo: 70, warnHi: 180 } : { min: 1.1, max: 33, warnLo: 3.9, warnHi: 10 };
  const FIELDS: Field[] = [
    { key: 'sbp', label: 'Systolic BP', unit: 'mmHg', min: 60, max: 260, warnLo: 90, warnHi: 140 },
    { key: 'dbp', label: 'Diastolic BP', unit: 'mmHg', min: 30, max: 160, warnLo: 50, warnHi: 90 },
    { key: 'glucose', label: 'Blood glucose', unit, ...g },
    { key: 'coreTemp', label: 'Body temperature', unit: '°C', min: 30, max: 43, warnLo: 36, warnHi: 38 },
  ];

  useEffect(() => { set({ painPick: step === 3 }); return () => set({ painPick: false }); }, [step, set]);
  useEffect(() => { if (pendingPain && !(pendingPain in pain)) setPain((p) => ({ ...p, [pendingPain]: 4 })); }, [pendingPain, pain]);

  const check = (f: Field) => {
    const raw = vals[f.key];
    if (!raw) return { ok: true, msg: '' };
    const v = Number(raw.replace(',', '.'));
    if (!Number.isFinite(v)) return { ok: false, msg: 'Not a number' };
    if (v < f.min || v > f.max) return { ok: false, msg: `Implausible — check the device (${f.min}–${f.max})` };
    if (v < f.warnLo || v > f.warnHi) return { ok: true, msg: 'Out of usual range — re-measure to confirm' };
    return { ok: true, msg: '' };
  };
  const valid = FIELDS.every((f) => check(f).ok) && (vals.sbp && vals.dbp ? Number(vals.sbp) > Number(vals.dbp) : true);

  const save = () => {
    const o: Partial<DailyTelemetryLog> = { inputSource: 'manual', sleepHours: sleep, pain };
    if (mood) o.mood = mood;
    for (const f of FIELDS) {
      const raw = vals[f.key];
      if (!raw) continue;
      let v = Number(raw.replace(',', '.'));
      if (f.key === 'glucose' && unit === 'mmol/L') v = Math.round(v * 18);
      o[f.key] = v;
    }
    if (camHr) o.hr = camHr;
    setOverride(o);
    completeTask('questionnaire');
    if (vals.sbp) completeTask('bp');
    if (vals.glucose) completeTask('glucose');
    set({ checkinOpen: false, pendingPainZone: null });
  };

  const steps = ['Mood', 'Sleep', 'Measurements', 'Where does it hurt?', 'Camera'];

  return (
    <motion.aside initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0 }}
      className="glass fixed bottom-3 right-3 top-[76px] z-40 flex w-[min(420px,calc(100vw-24px))] flex-col rounded-xl border-white/15" aria-label="Daily check-in">
      <header className="flex items-center justify-between border-b border-slate-800 p-3">
        <div>
          <div className="text-sm font-bold">Daily check-in <span className="text-xs font-normal text-slate-400">· ≤ 60 s</span></div>
          <div className="text-[11px] text-slate-400">Step {step + 1}/{steps.length}: {steps[step]}</div>
        </div>
        <button onClick={() => set({ checkinOpen: false })} aria-label="Close check-in"><X size={18} /></button>
      </header>
      <div className="h-1 bg-slate-800"><div className="h-full bg-sky-400 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>

      <div className="flex-1 overflow-y-auto p-4 scroll-thin">
        {step === 0 && (
          <div>
            <p className="mb-3 text-sm text-slate-300">How do you feel today?</p>
            <div className="flex justify-between">
              {MOODS.map((m) => (
                <button key={m.v} onClick={() => setMood(m.v)} aria-pressed={mood === m.v} className={`flex flex-col items-center rounded-lg p-2 ${mood === m.v ? 'bg-sky-500/25 ring-1 ring-sky-400' : 'hover:bg-slate-800'}`}>
                  <span className="text-3xl">{m.e}</span><span className="text-[10px] text-slate-400">{m.l}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 1 && (
          <div>
            <label className="text-sm text-slate-300" htmlFor="sleep">Hours of sleep last night: <b className="num text-sky-200">{sleep.toFixed(1)} h</b></label>
            <input id="sleep" type="range" min={0} max={10} step={0.25} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} className="mt-3 w-full accent-sky-400" />
            <p className="mt-2 text-xs text-slate-500">The actigraphy watch also measures this; your answer is stored as a manual entry.</p>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">How to measure BP in microgravity: feet in foot loops, arm at heart level, rest 5 min, cuff on bare arm.</p>
            {FIELDS.map((f) => {
              const c = check(f);
              return (
                <label key={f.key} className="block">
                  <span className="text-xs text-slate-300">{f.label} <span className="text-slate-500">({f.unit})</span></span>
                  <input inputMode="decimal" value={vals[f.key] ?? ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                    className={`num mt-1 w-full rounded-md bg-slate-900 px-3 py-2 text-sm ring-1 ${!c.ok ? 'ring-red-500' : c.msg ? 'ring-yellow-500' : 'ring-slate-700'}`} placeholder="leave empty to skip" />
                  {c.msg && <span className={`text-[11px] ${c.ok ? 'text-yellow-300' : 'text-red-300'}`}>{c.msg}</span>}
                </label>
              );
            })}
            {vals.sbp && vals.dbp && Number(vals.sbp) <= Number(vals.dbp) && <p className="text-[11px] text-red-300">Systolic must be higher than diastolic.</p>}
          </div>
        )}
        {step === 3 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm text-slate-300"><Hand size={15} className="text-sky-300" /> Click the body on the 3D twin, or pick below.</p>
            <div className="mb-3 flex flex-wrap gap-1">
              {ZONE_IDS.filter((z) => z !== 'skin_immune').map((z) => (
                <button key={z} onClick={() => setPain((p) => (z in p ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== z)) : { ...p, [z]: 4 }))}
                  className={`rounded px-2 py-0.5 text-[11px] ${z in pain ? 'bg-orange-500/25 text-orange-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{ZONES[z].name}</button>
              ))}
            </div>
            {Object.entries(pain).map(([z, v]) => (
              <label key={z} className="mb-2 block text-xs">
                <span className="text-slate-200">{ZONES[z as ZoneId].name}: pain <b className="num">{v}</b>/10</span>
                <input type="range" min={0} max={10} value={v} onChange={(e) => setPain({ ...pain, [z]: Number(e.target.value) })} className="w-full accent-orange-400" />
              </label>
            ))}
            {Object.keys(pain).length === 0 && <p className="text-xs text-slate-500">No pain — great. Skip this step.</p>}
          </div>
        )}
        {step === 4 && <CameraHR onResult={setCamHr} />}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-800 p-3">
        <button disabled={step === 0} onClick={() => setStep(step - 1)} className="flex items-center gap-1 rounded px-2 py-1 text-sm text-slate-300 disabled:opacity-30"><ChevronLeft size={15} /> Back</button>
        {step < steps.length - 1
          ? <button onClick={() => setStep(step + 1)} disabled={step === 2 && !valid} className="flex items-center gap-1 rounded-md bg-sky-500/25 px-3 py-1.5 text-sm font-semibold text-sky-100 disabled:opacity-40">Next <ChevronRight size={15} /></button>
          : <button onClick={save} disabled={!valid} className="flex items-center gap-1 rounded-md bg-emerald-500/25 px-3 py-1.5 text-sm font-semibold text-emerald-100 disabled:opacity-40"><Save size={15} /> Save check-in</button>}
      </footer>
    </motion.aside>
  );
}
