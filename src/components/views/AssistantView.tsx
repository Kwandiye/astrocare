'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Send, ShieldCheck, AlertTriangle, OctagonX, MapPin, Wind, X } from 'lucide-react';
import { useHealthStore, type AiRole, type ChatMsg } from '@/store/useHealthStore';
import { briefing, answer, QUICK, ROLE_META, type AiOut } from '@/lib/astroAI';
import { useAiCtx } from '@/hooks/useAiCtx';
import { postAsk } from '@/lib/brainHttp';
import { STATUS_META } from '@/lib/status';
import { ROLE_ICON } from '@/components/overview/NextActions';
import type { useDashboard } from '@/hooks/useDashboard';
import type { ZoneId } from '@/types/health';

const ROLES: AiRole[] = ['doctor', 'fitness', 'nutrition', 'mind'];
let nextId = 1;
type Msg = ChatMsg & { action?: AiOut['action']; zone?: ZoneId };

/** Paced breathing: in 4 s · hold 4 s · out 6 s, for 2 minutes. */
function Breathing({ onClose }: { onClose: () => void }) {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT((x) => x + 0.1), 100); return () => clearInterval(id); }, []);
  const cycle = t % 14;
  const phase = cycle < 4 ? 'Breathe in' : cycle < 8 ? 'Hold' : 'Breathe out';
  const scale = cycle < 4 ? 0.6 + 0.4 * (cycle / 4) : cycle < 8 ? 1 : 1 - 0.4 * ((cycle - 8) / 6);
  const left = Math.max(0, 120 - t);
  useEffect(() => { if (left === 0) onClose(); }, [left, onClose]);
  return (
    <div className="card relative flex flex-col items-center rounded-card p-6" role="timer" aria-label="Breathing exercise">
      <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1 text-muted hover:bg-raised" aria-label="Stop exercise"><X size={16} /></button>
      <div className="relative flex h-44 w-44 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-info/10" />
        <div className="rounded-full bg-info/30 transition-transform duration-100 ease-linear" style={{ width: 176, height: 176, transform: `scale(${scale})` }} />
        <span className="absolute text-lg font-semibold text-ink">{phase}</span>
      </div>
      <div className="num mt-3 text-sm text-muted">{Math.floor(left / 60)}:{String(Math.floor(left % 60)).padStart(2, '0')} remaining · in 4 · hold 4 · out 6</div>
    </div>
  );
}

function Bubble({ m, onZone, onBreathe }: { m: Msg; onZone: (z: ZoneId) => void; onBreathe: () => void }) {
  if (m.from === 'user') {
    return <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-info/90 px-4 py-2.5 text-[15px] text-canvas">{m.text}</div>;
  }
  const Icon = ROLE_ICON[m.role];
  const pr = m.priority ? STATUS_META[m.priority] : null;
  return (
    <div className="flex max-w-[88%] gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-info"><Icon size={16} /></div>
      <div className="min-w-0 rounded-2xl rounded-tl-md bg-raised px-4 py-3" style={pr ? { boxShadow: `inset 3px 0 0 ${pr.color}` } : undefined}>
        {pr && <div className="mb-1 flex items-center gap-1 text-xs font-semibold" style={{ color: pr.color }}>{m.priority === 'red' ? <OctagonX size={13} /> : <AlertTriangle size={13} />}{m.priority === 'red' ? 'Priority — critical' : 'Needs attention'}</div>}
        <p className="text-[15px] leading-relaxed text-slate-100">{m.text}</p>
        {m.steps && m.steps.length > 0 && (
          <ol className="mt-2 space-y-1 text-sm text-slate-200">
            {m.steps.map((s, i) => <li key={i} className="flex gap-2"><span className="num text-muted">{i + 1}.</span><span>{s}</span></li>)}
          </ol>
        )}
        {(m.zone || m.action === 'breathing') && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {m.zone && <button onClick={() => onZone(m.zone!)} className="flex items-center gap-1 rounded-lg bg-card px-2.5 py-1 text-xs text-ink hover:bg-canvas"><MapPin size={12} />Show on body & protocol</button>}
            {m.action === 'breathing' && <button onClick={onBreathe} className="flex items-center gap-1 rounded-lg bg-card px-2.5 py-1 text-xs text-ink hover:bg-canvas"><Wind size={12} />Start breathing exercise</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export function AssistantView({ d }: { d: ReturnType<typeof useDashboard> }) {
  const role = useHealthStore((s) => s.aiRole);
  const chat = useHealthStore((s) => s.chat) as Msg[];
  const set = useHealthStore((s) => s.set);
  const selectZone = useHealthStore((s) => s.selectZone);
  const ctx = useAiCtx(d);
  const [input, setInput] = useState('');
  const [breathing, setBreathing] = useState(false);
  const [asking, setAsking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const ctxKey = `${d.astronaut.id}:${d.log.missionDay}:${d.env.id}`;
  const keyRef = useRef(ctxKey);

  const toMsgs = (r: AiRole, outs: AiOut[]): Msg[] => outs.map((o) => ({ id: nextId++, from: 'ai', role: r, text: o.text, priority: o.priority, steps: o.steps, action: o.action, zone: o.zone, at: Date.now() }));

  // new astronaut / day / location → fresh conversation
  useEffect(() => {
    if (keyRef.current !== ctxKey) { keyRef.current = ctxKey; set({ chat: [] }); }
  }, [ctxKey, set]);
  // open each role with its briefing
  useEffect(() => {
    if (!chat.some((m) => m.role === role)) set({ chat: [...chat, ...toMsgs(role, briefing(role, ctx))] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, chat.length === 0, ctxKey]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chat.length, role]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text) return;
    const liveDoctor = role === 'doctor' && d.tick?.doctorSource && d.tick.astronautId;
    if (liveDoctor) {
      const user: Msg = { id: nextId++, from: 'user', role, text, at: Date.now() };
      set({ chat: [...useHealthStore.getState().chat, user] });
      setInput('');
      setAsking(true);
      try {
        const response = await postAsk(d.tick!.astronautId!, text);
        const source = response.source === 'llm' ? 'Brain · LLM' : 'Brain · fallback';
        const answerMsg: Msg = { id: nextId++, from: 'ai', role: 'doctor', text: `${source}: ${response.answer}`, at: Date.now() };
        set({ chat: [...useHealthStore.getState().chat, answerMsg] });
      } catch {
        const res = answer(text, role, ctx);
        set({ chat: [...useHealthStore.getState().chat, ...toMsgs(res.role, res.out)] });
      } finally {
        setAsking(false);
      }
      return;
    }
    const res = answer(text, role, ctx);
    const user: Msg = { id: nextId++, from: 'user', role: res.role, text, at: Date.now() };
    set({ chat: [...useHealthStore.getState().chat, user, ...toMsgs(res.role, res.out)], aiRole: res.role });
    if (res.out.some((o) => o.action === 'breathing') && /breath|relax|calm/i.test(text)) setBreathing(true);
    setInput('');
  };

  const priorities = useMemo(() => ROLES.map((r) => ({ r, top: briefing(r, ctx).find((x) => x.priority) })), [ctx]);
  const brainConditions = d.tick?.likelyConditions ?? [];
  const thread = chat.filter((m) => m.role === role);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      {/* left: roles + priority alerts */}
      <aside className="space-y-4">
        <div className="card rounded-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-info/15 text-info"><Sparkles size={22} /></div>
            <div>
              <h1 className="text-lg font-semibold text-ink">Astro AI</h1>
              <p className="text-xs text-muted">Onboard health companion · works offline</p>
            </div>
          </div>
          <nav className="mt-4 space-y-1" aria-label="Assistant roles">
            {ROLES.map((r) => {
              const Icon = ROLE_ICON[r];
              const p = priorities.find((x) => x.r === r)?.top?.priority;
              return (
                <button key={r} onClick={() => set({ aiRole: r })} aria-current={role === r}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${role === r ? 'bg-raised' : 'hover:bg-raised/50'}`}>
                  <Icon size={18} className={role === r ? 'text-info' : 'text-muted'} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-ink">{ROLE_META[r].name}</span>
                    <span className="block text-xs text-muted">{ROLE_META[r].tagline}</span>
                  </span>
                  {p && <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[p].color }} aria-label={STATUS_META[p].label} />}
                </button>
              );
            })}
          </nav>
        </div>

        {role === 'doctor' && d.tick && (
          <div className="card rounded-card p-4">
            <h2 className="text-sm font-semibold text-ink">Brain assessment</h2>
            <p className="mt-1 text-xs text-muted">Evidence score, not a probability. Never a diagnosis.</p>
            {brainConditions.length === 0 ? <p className="mt-3 text-sm text-ok">No condition candidates from the brain.</p> : (
              <ul className="mt-3 space-y-3">
                {brainConditions.map((condition) => <li key={condition.code} className="rounded-xl bg-raised/60 p-2.5">
                  <div className="flex items-center justify-between gap-2 text-sm font-medium text-slate-200"><span>{condition.label}</span><span className="num text-xs text-warn">{Math.round(condition.confidence * 100)}%</span></div>
                  <div className="mt-1 text-xs text-muted">Drivers: {condition.drivers.join(', ')}</div>
                  {condition.resources && condition.resources.length > 0 && <div className="mt-2 text-xs text-slate-300">{condition.resources.map((resource) => `${resource.name} (${resource.onboard === null ? 'unknown' : resource.onboard ? 'onboard' : 'missing'})`).join(' · ')}</div>}
                </li>)}
              </ul>
            )}
          </div>
        )}

        <div className="card rounded-card p-4">
          <h2 className="text-sm font-semibold text-ink">Priority alerts</h2>
          <ul className="mt-2 space-y-2">
            {priorities.filter((x) => x.top).length === 0 && <li className="text-sm text-ok">Nothing needs your attention right now.</li>}
            {priorities.filter((x) => x.top).sort((a, b) => (a.top!.priority === 'red' ? -1 : 1) - (b.top!.priority === 'red' ? -1 : 1)).map(({ r, top }) => (
              <li key={r}>
                <button onClick={() => set({ aiRole: r })} className="w-full rounded-xl bg-raised/60 p-2.5 text-left text-sm hover:bg-raised" style={{ boxShadow: `inset 3px 0 0 ${STATUS_META[top!.priority!].color}` }}>
                  <span className="block text-xs text-muted">{ROLE_META[r].name}</span>
                  <span className="line-clamp-2 text-slate-200">{top!.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex gap-2 rounded-card bg-raised/50 p-3 text-xs leading-relaxed text-muted">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-ok" />
          Astro AI explains your measurements using the onboard protocols. It does not diagnose and does not replace the Crew Medical Officer or the flight surgeon.
        </p>
      </aside>

      {/* chat */}
      <section className="card flex min-h-[640px] flex-col rounded-card lg:h-[calc(100vh-110px)]" aria-label={`${ROLE_META[role].name} conversation`}>
        <header className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
          {(() => { const Icon = ROLE_ICON[role]; return <Icon size={18} className="text-info" />; })()}
          <div>
            <h2 className="text-sm font-semibold text-ink">{ROLE_META[role].name}</h2>
            <p className="text-xs text-muted">{ROLE_META[role].tagline} · {d.astronaut.name}, day {d.log.missionDay}</p>
          </div>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 scroll-thin" aria-live="polite">
          {thread.map((m) => <Bubble key={m.id} m={m} onZone={(z) => selectZone(z)} onBreathe={() => setBreathing(true)} />)}
          {breathing && <Breathing onClose={() => setBreathing(false)} />}
          <div ref={endRef} />
        </div>
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {QUICK[role].map((q) => (
              <button key={q} onClick={() => (q.startsWith('Start a breathing') ? (setBreathing(true), ask(q)) : ask(q))}
                className="rounded-full bg-raised px-3 py-1.5 text-xs text-slate-200 hover:bg-[#22324a]">{q}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="flex items-center gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask ${ROLE_META[role].name} — e.g. "Why is my heart rate up?"`}
              className="flex-1 rounded-xl bg-raised px-4 py-3 text-[15px] text-ink placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-info/60" aria-label="Your question" />
            <button type="submit" disabled={!input.trim() || asking} className="flex h-11 w-11 items-center justify-center rounded-xl bg-info text-canvas disabled:opacity-40" aria-label="Send"><Send size={18} /></button>
          </form>
        </div>
      </section>
    </div>
  );
}
