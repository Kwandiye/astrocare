'use client';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ChevronDown, Lightbulb, Send, Clock, CheckSquare, Square, Ruler, HelpCircle, Rocket, Siren, ShieldCheck,
  Hand, Droplets, Wind, Phone, HardHat, Shield, Utensils, BedDouble, Eye, Dumbbell, Pill, Thermometer, ClipboardList, MoveRight, Paperclip, Camera,
  type LucideIcon,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { useHealthStore } from '@/store/useHealthStore';
import { ZONES, SYSTEM_LABEL, HAZARD_COLORS } from '@/data/zones';
import { getProtocol, protocolIdFor, DISCLAIMER, type StepIcon } from '@/lib/protocols';
import { STATUS_META } from '@/lib/status';
import { StatusBadge, Sparkline } from '@/components/ui/StatusBadge';
import { slope } from '@/lib/trend';
import { fmtDuration, replyExpectedSec, isAutonomous } from '@/lib/commDelay';
import { useLabels } from '@/lib/labels';
import type { Metric, ZoneId, ZoneState, TriageStatus } from '@/types/health';
import type { EnvironmentProfile } from '@/lib/environments';

const STEP_ICONS: Record<StepIcon, LucideIcon> = {
  stop: Hand, measure: Ruler, water: Droplets, breath: Wind, check: ShieldCheck, phone: Phone, mask: HardHat, shield: Shield,
  food: Utensils, sleep: BedDouble, eye: Eye, dumbbell: Dumbbell, pill: Pill, thermo: Thermometer, clipboard: ClipboardList, move: MoveRight,
};

function DeviationBar({ m }: { m: Metric }) {
  if (m.zScore == null) {
    return <div className="text-[10px] text-slate-500">absolute limit</div>;
  }
  const zc = Math.max(-4.5, Math.min(4.5, m.zScore));
  const pct = 50 + (zc / 4.5) * 50;
  return (
    <div className="relative h-2.5 w-28 rounded-full bg-slate-800" aria-label={`${m.zScore.toFixed(1)} sigma`}>
      {/* bands: |z|≤1.5 green, 1.5–3 yellow, >3 red */}
      <div className="absolute inset-y-0 rounded-l-full bg-red-500/30" style={{ left: 0, width: `${50 - (3 / 4.5) * 50}%` }} />
      <div className="absolute inset-y-0 bg-yellow-500/30" style={{ left: `${50 - (3 / 4.5) * 50}%`, width: `${(1.5 / 4.5) * 50}%` }} />
      <div className="absolute inset-y-0 bg-green-500/35" style={{ left: `${50 - (1.5 / 4.5) * 50}%`, width: `${(3 / 4.5) * 50}%` }} />
      <div className="absolute inset-y-0 bg-yellow-500/30" style={{ left: `${50 + (1.5 / 4.5) * 50}%`, width: `${(1.5 / 4.5) * 50}%` }} />
      <div className="absolute inset-y-0 rounded-r-full bg-red-500/30" style={{ left: `${50 + (3 / 4.5) * 50}%`, right: 0 }} />
      <div className="absolute -top-0.5 h-3.5 w-0.5 bg-slate-400" style={{ left: '50%' }} />
      <div className="absolute -top-1 w-1.5 rounded bg-white" style={{ left: `calc(${pct}% - 3px)`, height: 18 }} />
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: LucideIcon; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-slate-800">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between py-2.5 text-left text-sm font-semibold text-slate-200">
        <span className="flex items-center gap-2"><Icon size={15} className="text-sky-400" aria-hidden />{title}</span>
        <ChevronDown size={15} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-3 text-sm text-slate-300">{children}</div>}
    </div>
  );
}

function summary(z: ZoneState): string {
  const name = ZONES[z.zoneId].name.split(' (')[0];
  const worst = [...z.metrics].filter((m) => m.status !== 'green').sort((a, b) => (b.status === 'red' ? 1 : 0) - (a.status === 'red' ? 1 : 0))[0];
  if (!worst) return `${name}: all signals are within your personal baseline.`;
  if (z.zoneId === 'heart' && worst.id === 'hr' && (worst.deviationPct ?? 0) > 0) return `Your heart is working ${Math.round(worst.deviationPct!)}% harder than your baseline.`;
  if (worst.deviationPct != null) return `${worst.label} is ${Math.abs(Math.round(worst.deviationPct))}% ${worst.deviationPct > 0 ? 'above' : 'below'} your baseline.`;
  return worst.reason ?? `${name} needs attention.`;
}

/** Simple 72 h projection from the 7-day trend of the worst z-metric. */
function useForecast(z: ZoneState) {
  return useMemo(() => {
    const m = [...z.metrics].filter((x) => x.baseline && x.trend7d.length >= 3)
      .sort((a, b) => Math.abs(b.zScore ?? 0) - Math.abs(a.zScore ?? 0))[0];
    if (!m || !m.baseline) return null;
    const s = slope(m.trend7d);
    const last = m.value;
    const pts = m.trend7d.map((v, i) => ({ d: i - (m.trend7d.length - 1), actual: v, proj: null as number | null }));
    pts[pts.length - 1].proj = last;
    for (let i = 1; i <= 3; i++) pts.push({ d: i, actual: null as unknown as number, proj: last + s * i });
    const projZ = (last + s * 3 - m.baseline.mean) / m.baseline.sd;
    const zNow = m.zScore ?? 0;
    const risk = zNow > 3 || zNow < -3 ? 100 : Math.round(100 / (1 + Math.exp(-(Math.abs(projZ) - 3) * 1.6)));
    return { m, pts, risk, s };
  }, [z]);
}

export function ZonePanel({ zone, env, status }: { zone: ZoneState; env: EnvironmentProfile; status: TriageStatus }) {
  const info = ZONES[zone.zoneId];
  const selectZone = useHealthStore((s) => s.selectZone);
  const checks = useHealthStore((s) => s.protocolChecks);
  const toggle = useHealthStore((s) => s.toggleStep);
  const escalate = useHealthStore((s) => s.escalate);
  const escalations = useHealthStore((s) => s.escalations);
  const attachments = useHealthStore((s) => s.attachments[zone.zoneId] ?? []);
  const setStore = useHealthStore((s) => s.set);
  const astronautId = useHealthStore((s) => s.astronautId);
  const day = useHealthStore((s) => s.day);
  const L = useLabels();
  const proto = getProtocol(zone.status === status ? zone.protocolId : protocolIdFor(zone.zoneId, status));
  const key = `${proto?.id}:${astronautId}:${day}`;
  const done = checks[key] ?? [];
  const fc = useForecast(zone);
  const mine = escalations.filter((e) => e.zone === zone.zoneId);
  const now = Date.now();
  const color = STATUS_META[status].color;

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const cur = useHealthStore.getState().attachments;
    setStore({ attachments: { ...cur, [zone.zoneId]: [...(cur[zone.zoneId] ?? []), { name: f.name, url, at: Date.now() }] } });
  };

  return (
    <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
      className="glass flex max-h-full flex-col overflow-hidden rounded-xl" aria-label={`${info.name} details`}>
      <header className="border-b border-slate-800 p-4" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
        <button onClick={() => selectZone(null)} className="mb-2 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"><ArrowLeft size={13} /> Back to full body (Esc)</button>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">{info.name}</h2>
            <div className="text-xs text-slate-400">{SYSTEM_LABEL[zone.system]}</div>
          </div>
          <StatusBadge status={status} size="lg" />
        </div>
        <p className="mt-2 text-[15px] text-slate-100">{summary(zone)}</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 scroll-thin">
        {/* Metrics table */}
        {zone.metrics.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="pb-1">Metric</th><th>Now</th><th>Baseline</th><th>Deviation</th><th>% · σ</th><th>7 d</th></tr>
              </thead>
              <tbody>
                {zone.metrics.map((m) => {
                  const mc = STATUS_META[m.status];
                  const MIcon = mc.icon;
                  return (
                    <tr key={m.id} className="border-t border-slate-800/70 align-middle">
                      <td className="py-1.5 pr-2"><span className="flex items-center gap-1"><MIcon size={12} color={mc.color} aria-label={mc.label} />{m.label}</span></td>
                      <td className="num pr-2 font-semibold" style={{ color: m.status === 'green' ? undefined : mc.color }}>{m.id === 'opticDiscEdema' ? (m.value ? 'yes' : 'no') : Number.isInteger(m.value) ? m.value : m.value.toFixed(2)} <span className="text-slate-500">{m.unit}</span></td>
                      <td className="num pr-2 text-slate-400">{m.baseline ? `${m.baseline.mean}±${m.baseline.sd}` : '—'}</td>
                      <td className="pr-2"><DeviationBar m={m} /></td>
                      <td className="num pr-2 text-slate-300">{m.deviationPct != null ? `${m.deviationPct > 0 ? '+' : ''}${m.deviationPct.toFixed(0)}% · ${m.zScore!.toFixed(1)}σ` : '—'}</td>
                      <td><Sparkline values={m.trend7d} color={m.status === 'green' ? '#38BDF8' : mc.color} width={60} height={20} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Why */}
        {zone.drivers.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300"><Lightbulb size={13} /> Why</div>
            <ul className="space-y-1 text-[13px] text-slate-200">{zone.drivers.map((d) => <li key={d}>• {d}</li>)}</ul>
          </div>
        )}

        {/* Protocol */}
        {proto && (
          <div className="rounded-lg border p-3" style={{ borderColor: `${color}55` }}>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">{proto.title}</div>
              <span className="text-[11px] text-slate-400">{done.filter(Boolean).length}/{proto.steps.length} done</span>
            </div>
            <ol className="space-y-1.5">
              {proto.steps.map((s, i) => {
                const SI = STEP_ICONS[s.icon];
                return (
                  <li key={i}>
                    <button onClick={() => toggle(key, i, proto.steps.length)} className={`flex w-full items-start gap-2 rounded-md p-1.5 text-left text-[13px] hover:bg-slate-800/60 ${s.isEscalation ? 'bg-orange-500/10' : ''}`}>
                      {done[i] ? <CheckSquare size={17} className="mt-0.5 shrink-0 text-emerald-400" /> : <Square size={17} className="mt-0.5 shrink-0 text-slate-500" />}
                      <SI size={15} className={`mt-0.5 shrink-0 ${s.isEscalation ? 'text-orange-300' : 'text-sky-300'}`} aria-hidden />
                      <span className={done[i] ? 'text-slate-500 line-through' : 'text-slate-100'}>
                        <span className="num text-slate-500">{i + 1}. </span>{s.text.replace('flight surgeon', L.surgeon)}
                        {s.durationMin ? <span className="ml-1 whitespace-nowrap text-[11px] text-slate-500"><Clock size={10} className="inline" /> {s.durationMin} min</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-[10px] text-slate-500">{DISCLAIMER} Refs: {proto.references.join(' · ')}</p>
          </div>
        )}

        {/* Escalation */}
        {status !== 'green' && (
          <div className="rounded-lg bg-slate-900/60 p-3">
            <button onClick={() => escalate(zone.zoneId, `${info.name}: ${zone.drivers[0] ?? 'status ' + status}`, env.delaySec)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500/20 px-3 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-500/30">
              <Send size={15} /> Send report to {L.mc}
            </button>
            {mine.slice(0, 2).map((e) => {
              const arrive = Math.max(0, (e.arriveAt - now) / 1000);
              const reply = Math.max(0, (e.replyAt - now) / 1000);
              return (
                <div key={e.id} className="mt-2 rounded-md border border-slate-700 p-2 text-xs">
                  <div className="num">{arrive > 0 ? <>Arrives on Earth in <b className="text-orange-200">{fmtDuration(arrive)}</b></> : <span className="text-emerald-300">Delivered to {L.mc}</span>}
                    {' · '}reply expected in ~{fmtDuration(reply)}</div>
                  {isAutonomous(env.delaySec) && <div className="mt-1 text-amber-200">Act autonomously meanwhile: complete the protocol above; the {L.cmo} leads care until Earth replies.</div>}
                </div>
              );
            })}
            {mine.length === 0 && <p className="mt-2 text-[11px] text-slate-400">One-way delay {fmtDuration(env.delaySec)} · reply ≈ {fmtDuration(replyExpectedSec(env.delaySec))}. A 24 h report and attachments are included.</p>}
          </div>
        )}

        {/* Forecast */}
        {fc && (
          <div className="rounded-lg bg-slate-900/50 p-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-400">72 h forecast · {fc.m.label}</span>
              <span className={fc.risk >= 50 ? 'text-red-300' : fc.risk >= 20 ? 'text-yellow-300' : 'text-emerald-300'}>risk of RED in 72 h: <b>{fc.risk}%</b></span>
            </div>
            <div className="h-28">
              <ResponsiveContainer>
                <LineChart data={fc.pts} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
                  <XAxis dataKey="d" tick={{ fill: '#64748B', fontSize: 10 }} tickFormatter={(v) => (v === 0 ? 'now' : `${v > 0 ? '+' : ''}${v}d`)} />
                  <YAxis tick={{ fill: '#64748B', fontSize: 10 }} domain={['auto', 'auto']} />
                  <ReferenceArea y1={fc.m.baseline!.mean - 1.5 * fc.m.baseline!.sd} y2={fc.m.baseline!.mean + 1.5 * fc.m.baseline!.sd} fill="#22C55E" fillOpacity={0.1} />
                  <ReferenceLine x={0} stroke="#475569" />
                  <Tooltip contentStyle={{ background: '#141E2D', border: '1px solid #22304A', fontSize: 11 }} />
                  <Line dataKey="actual" stroke="#38BDF8" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line dataKey="proj" stroke="#F97316" strokeDasharray="4 3" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* The 5 judge questions */}
        <div>
          <Section title="Can it be measured in space?" icon={Ruler} defaultOpen>{info.measure}</Section>
          <Section title="Why this exam?" icon={HelpCircle}>{info.why}</Section>
          <Section title="How spaceflight affects it" icon={Rocket}>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {info.hazards.map((h) => <span key={h} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${HAZARD_COLORS[h]}22`, color: HAZARD_COLORS[h] }}>{h}</span>)}
            </div>
            <p>{info.about}</p>
            <p className="mt-1 text-slate-400">{info.hazardText}</p>
            <ul className="mt-1 list-disc pl-4 text-slate-400">{info.risks.map((r) => <li key={r}>{r}</li>)}</ul>
          </Section>
          <Section title="When to act" icon={Siren}>
            <p><span className="font-semibold text-yellow-300">Yellow — self-care + {L.cmo}:</span> {info.whenYellow}</p>
            <p className="mt-1"><span className="font-semibold text-red-300">Red — {L.surgeon} on Earth:</span> {info.whenRed}</p>
          </Section>
          <Section title="What to do / how to prevent" icon={ShieldCheck}>
            <ul className="list-disc pl-4">{info.prevent.map((p) => <li key={p}>{p}</li>)}</ul>
            {!proto && <p className="mt-1 text-slate-400">No active protocol — keep the prevention routine.</p>}
          </Section>
        </div>

        {/* Camera / image attachments */}
        <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-300"><Paperclip size={13} /> Attach image for the {L.surgeon}</div>
          <p className="mb-2 text-slate-500">Ultrasound, skin rash or eye-fundus photo. Attached to the zone record and the report. No AI diagnosis.</p>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded bg-slate-800 px-2 py-1 hover:bg-slate-700">
            <Camera size={13} /> Upload / take photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {attachments.map((a) => <img key={a.url} src={a.url} alt={a.name} className="h-16 w-16 rounded object-cover ring-1 ring-slate-600" />)}
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

export type { ZoneId };
