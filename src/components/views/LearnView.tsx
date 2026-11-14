'use client';
import { useState } from 'react';
import { ZONES, HAZARD_COLORS, type Hazard } from '@/data/zones';
import { ZONE_IDS } from '@/types/health';
import { useHealthStore } from '@/store/useHealthStore';

const HAZARDS: Record<Hazard, string> = {
  Radiation: 'Outside Earth’s magnetic field, galactic cosmic rays and solar particle events raise cancer and acute risks. ~30% of the ISS dose comes from neutrons. Shielding and dosimetry keep you within career limits.',
  'Isolation & Confinement': 'Small crews in small spaces for months. Sleep, mood and teamwork suffer. Routines, private calls and early signs of stress matter.',
  'Distance from Earth': 'Help is far away. On Mars a message takes up to 22 minutes one way, so the crew must act autonomously with on-board protocols.',
  'Gravity Fields': 'Microgravity shifts fluids to the head, unloads bones and muscles and confuses balance. Each gravity change (0 g, Moon 0.16 g, Mars 0.38 g, Earth) requires re-adaptation.',
  'Hostile/Closed Environment': 'Air, water and temperature are machine-made. CO₂ can build up, noise and light disturb sleep, and microbes behave differently.',
};

export const GLOSSARY: Record<string, string> = {
  'Baseline (μ ± σ)': 'Your own normal value (mean μ) and typical spread (σ) measured in this mission phase — not an Earth population average.',
  'Z-score (σ)': 'How many “typical spreads” today’s value is from your baseline. |z| ≤ 1.5 green, 1.5–3 yellow, > 3 red.',
  'HRV (RMSSD)': 'Heart-rate variability: small beat-to-beat changes. Higher usually means better recovery.',
  'SpO₂': 'Oxygen saturation of the blood, measured with a finger clip. Below 94% needs attention, below 90% is critical.',
  'ppCO₂': 'Partial pressure of carbon dioxide in the cabin air. Above 3 mmHg causes headaches and fatigue; ≥ 7.6 mmHg is an emergency.',
  'PVT-B': 'Psychomotor Vigilance Test (brief): a 3-minute reaction-time test that detects fatigue.',
  SANS: 'Spaceflight-Associated Neuro-ocular Syndrome: eye changes such as optic disc swelling caused by fluid shift.',
  'Optic disc edema': 'Swelling where the optic nerve enters the eye; seen on OCT or fundoscope images.',
  'BMD': 'Bone mineral density. In microgravity weight-bearing bones lose about 1–1.5% per month without countermeasures.',
  ARED: 'Advanced Resistive Exercise Device — the ISS “gym” that uses vacuum cylinders to simulate weights.',
  CDRA: 'Carbon Dioxide Removal Assembly — the ISS CO₂ scrubber.',
  'Orthostatic intolerance': 'Dizziness or fainting when standing up after returning to gravity.',
  'Mission Fatigue Index (MFI)': 'AstroCare composite 0–100 from HR, HRV, PVT, sleep efficiency and CO₂. ≥ 30 yellow, ≥ 65 red.',
  'NEWS2': 'National Early Warning Score 2 — a hospital early-warning system. AstroCare adapts its colour bands only as visual context.',
  CMO: 'Crew Medical Officer — the crewmember trained to give first-line care on board.',
  'Flight surgeon': 'The physician on Earth responsible for crew health.',
};

export function LearnView() {
  const [q, setQ] = useState('');
  const selectZone = useHealthStore((s) => s.selectZone);
  const set = useHealthStore((s) => s.set);
  const terms = Object.entries(GLOSSARY).filter(([k, v]) => (k + v).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Learn <span className="text-sm font-normal text-slate-400">— written for astronauts who are not doctors</span></h1>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(HAZARDS) as Hazard[]).map((h) => (
          <article key={h} className="glass rounded-xl p-3" style={{ borderColor: `${HAZARD_COLORS[h]}66` }}>
            <h2 className="mb-1 font-semibold" style={{ color: HAZARD_COLORS[h] }}>{h}</h2>
            <p className="text-sm text-slate-300">{HAZARDS[h]}</p>
          </article>
        ))}
      </section>
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Body zones</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {ZONE_IDS.map((z) => (
            <button key={z} onClick={() => { set({ view: 'dashboard' }); selectZone(z); }} className="glass rounded-xl p-3 text-left hover:ring-1 hover:ring-sky-400/40">
              <div className="font-semibold">{ZONES[z].name}</div>
              <p className="mt-0.5 line-clamp-3 text-xs text-slate-400">{ZONES[z].about}</p>
            </button>
          ))}
        </div>
      </section>
      <section className="glass rounded-xl p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Glossary</h2>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms…" className="rounded bg-slate-900 px-2 py-1 text-sm ring-1 ring-slate-700" />
        </div>
        <dl className="grid gap-x-6 gap-y-2 md:grid-cols-2">
          {terms.map(([k, v]) => <div key={k}><dt className="font-semibold text-sky-200">{k}</dt><dd className="text-sm text-slate-300">{v}</dd></div>)}
        </dl>
      </section>
    </div>
  );
}
