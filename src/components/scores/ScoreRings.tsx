'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { Score } from '@/lib/scores';
import { STATUS_META } from '@/lib/status';

function Ring({ score, onClick, active }: { score: Score; onClick: () => void; active: boolean }) {
  const color = STATUS_META[score.status].color;
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = score.id === 'eva' ? (score.status === 'green' ? 1 : score.status === 'yellow' ? 0.5 : 0.12)
    : score.id === 'bone' ? Math.min(1, score.value / score.max) : Math.min(1, score.value / score.max);
  const Icon = STATUS_META[score.status].icon;
  return (
    <button onClick={onClick} aria-expanded={active} className={`flex flex-col items-center rounded-xl p-1.5 transition ${active ? 'bg-slate-800/70' : 'hover:bg-slate-800/40'}`}>
      <svg width={70} height={70} viewBox="0 0 70 70" aria-hidden>
        <circle cx={35} cy={35} r={r} stroke="rgba(148,163,184,0.15)" strokeWidth={7} fill="none" />
        <circle cx={35} cy={35} r={r} stroke={color} strokeWidth={7} fill="none" strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 35 35)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        <text x={35} y={39} textAnchor="middle" className="num" fontSize={score.display.length > 5 ? 10 : 13} fontWeight={700} fill="#F1F5F9">{score.display}</text>
      </svg>
      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-300"><Icon size={11} color={color} aria-hidden />{score.label}</span>
    </button>
  );
}

/** WHOOP-style rings — but with space baselines, environment fusion and explanations. */
export function ScoreRings({ scores }: { scores: Score[] }) {
  const [open, setOpen] = useState<Score['id'] | null>(null);
  const s = scores.find((x) => x.id === open);
  return (
    <div>
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Readiness scores</h2>
      <div className="flex gap-1 overflow-x-auto pb-1 scroll-thin lg:grid lg:grid-cols-4 lg:overflow-visible">
        {scores.map((sc) => <Ring key={sc.id} score={sc} active={open === sc.id} onClick={() => setOpen(open === sc.id ? null : sc.id)} />)}
      </div>
      <AnimatePresence>
        {s && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass mt-2 rounded-xl p-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{s.label}: <span style={{ color: STATUS_META[s.status].color }}>{s.display}</span></div>
              <button onClick={() => setOpen(null)} aria-label="Close"><X size={14} /></button>
            </div>
            <div className="mt-2 text-[11px] uppercase tracking-wider text-slate-400">What&apos;s driving this</div>
            <ul className="mt-1 space-y-1">
              {s.contributors.length === 0 && <li className="text-slate-400">No significant contributors.</li>}
              {s.contributors.map((c) => (
                <li key={c.label} className="flex justify-between gap-2">
                  <span className="text-slate-200">{c.label}</span>
                  <span className={`num ${c.impact < 0 ? 'text-orange-300' : 'text-emerald-300'}`}>{c.impact > 0 ? '+' : ''}{c.impact}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-[11px] uppercase tracking-wider text-slate-400">What to do today</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slate-200">{s.advice.map((a) => <li key={a}>{a}</li>)}</ul>
            <div className="mt-2 text-[10px] text-slate-500">Formula: {s.formula}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
