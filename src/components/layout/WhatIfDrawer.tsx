'use client';
import { motion } from 'framer-motion';
import { FlaskConical, X } from 'lucide-react';
import { useHealthStore } from '@/store/useHealthStore';
import { WHAT_IFS } from '@/lib/simulator';

export function WhatIfDrawer() {
  const whatIfs = useHealthStore((s) => s.whatIfs);
  const toggle = useHealthStore((s) => s.toggleWhatIf);
  const set = useHealthStore((s) => s.set);
  return (
    <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}
      className="glass rounded-xl p-3" aria-label="What-if simulator">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><FlaskConical size={14} /> What-if simulator <span className="normal-case text-slate-500">— applied on top of the selected day</span></h2>
        <div className="flex items-center gap-2">
          {whatIfs.length > 0 && <button onClick={() => set({ whatIfs: [] })} className="text-xs text-slate-400 hover:text-slate-200">Reset</button>}
          <button onClick={() => set({ whatIfOpen: false })} aria-label="Close"><X size={15} /></button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {WHAT_IFS.map((w) => {
          const on = whatIfs.includes(w.id);
          return (
            <button key={w.id} onClick={() => toggle(w.id)} aria-pressed={on}
              className={`rounded-lg border p-2.5 text-left text-sm transition ${on ? 'border-pink-400/70 bg-pink-500/15' : 'border-slate-700 hover:bg-slate-800/60'}`}>
              <div className="font-semibold">{on ? '● ' : ''}{w.label}</div>
              <div className="text-xs text-slate-400">{w.description}</div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
