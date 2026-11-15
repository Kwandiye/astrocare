'use client';
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { AlertLevel, BrainTick, ConnectionState } from '@/types/brain';
import type { SystemId, ZoneId } from '@/types/health';
import type { EnvironmentId } from '@/lib/environments';
import type { Overrides, WhatIfId } from '@/lib/simulator';

export const RING_SIZE = 600; // 10 min at 1 Hz

/** Main tabs: dashboard (Overview) · analytics · assistant · training · history. Secondary: crew, radar, routine, learn. */
export type View = 'dashboard' | 'analytics' | 'assistant' | 'training' | 'history' | 'crew' | 'radar' | 'routine' | 'learn';
export type VitalKey = 'hr' | 'bp' | 'spo2' | 'resp' | 'temp' | 'glucose';
export type AiRole = 'doctor' | 'fitness' | 'nutrition' | 'mind';
export interface ChatMsg { id: number; from: 'ai' | 'user'; role: AiRole; text: string; priority?: 'red' | 'yellow'; steps?: string[]; at: number }
/** Anatomy layers, outermost first. 'all' = X-ray hologram with every zone visible. */
export type LayerMode = 'skin' | 'muscles' | 'organs' | 'skeleton' | 'all';
export const LAYER_ORDER: LayerMode[] = ['skin', 'muscles', 'organs', 'skeleton', 'all'];
export const nextLayer = (m: LayerMode): LayerMode => LAYER_ORDER[(LAYER_ORDER.indexOf(m) + 1) % LAYER_ORDER.length];

export interface AuditEntry { at: number; text: string }
export interface Escalation { id: string; at: number; zone: ZoneId | null; text: string; arriveAt: number; replyAt: number }

interface HealthState {
  // selection
  view: View;
  astronautId: string;
  day: number;
  envId: EnvironmentId;
  whatIfs: WhatIfId[];
  overrides: Record<string, Overrides>; // key `${astro}:${day}`
  selectedZone: ZoneId | null;
  hoveredZone: ZoneId | null;
  highlightZones: ZoneId[];
  systemFilter: SystemId | null;
  layerMode: LayerMode;
  viewSide: 'front' | 'back';
  metricDetail: VitalKey | null;
  aiRole: AiRole;
  chat: ChatMsg[];
  earthMode: boolean;
  glucoseUnit: 'mg/dL' | 'mmol/L';

  // live brain stream
  ticks: BrainTick[];
  lastTickAt: number | null;
  connection: ConnectionState;
  mode: 'live' | 'mock';
  level: AlertLevel | null;
  levelSince: number;
  prevLevel: AlertLevel | null;
  signalPaused: boolean;
  redBannerAt: number | null;

  // alerts / protocols
  muted: boolean;
  acks: Record<string, { at: number; snoozeUntil?: number }>;
  audit: AuditEntry[];
  protocolChecks: Record<string, boolean[]>;
  escalations: Escalation[];
  attachments: Record<string, { name: string; url: string; at: number }[]>; // key zone

  // modes
  demoPlaying: boolean;
  checkinOpen: boolean;
  whatIfOpen: boolean;
  painPick: boolean;
  pendingPainZone: ZoneId | null;

  // routine / gamification
  tasksDone: Record<string, boolean>; // key `${astro}:${day}:${taskId}`
  xp: number;

  // actions
  set: (p: Partial<HealthState>) => void;
  setDay: (d: number) => void;
  setAstronaut: (id: string) => void;
  selectZone: (z: ZoneId | null) => void;
  pushTick: (t: BrainTick) => void;
  log: (text: string) => void;
  ack: (key: string, snoozeMin?: number) => void;
  toggleStep: (key: string, idx: number, len: number) => void;
  setOverride: (o: Overrides) => void;
  escalate: (zone: ZoneId | null, text: string, oneWaySec: number) => void;
  toggleWhatIf: (id: WhatIfId) => void;
  completeTask: (taskId: string) => void;
}

const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const useHealthStore = create<HealthState>()(
  persist(
    (set, get) => ({
      view: 'dashboard',
      astronautId: 'astro-01',
      day: 52,
      envId: 'iss',
      whatIfs: [],
      overrides: {},
      selectedZone: null,
      hoveredZone: null,
      highlightZones: [],
      systemFilter: null,
      layerMode: 'all',
      viewSide: 'front',
      metricDetail: null,
      aiRole: 'doctor',
      chat: [],
      earthMode: false,
      glucoseUnit: 'mg/dL',

      ticks: [],
      lastTickAt: null,
      connection: 'connecting',
      mode: 'mock',
      level: null,
      levelSince: Date.now(),
      prevLevel: null,
      signalPaused: false,
      redBannerAt: null,

      muted: true,
      acks: {},
      audit: [],
      protocolChecks: {},
      escalations: [],
      attachments: {},

      demoPlaying: false,
      checkinOpen: false,
      whatIfOpen: false,
      painPick: false,
      pendingPainZone: null,

      tasksDone: {},
      xp: 0,

      set: (p) => set(p),
      setDay: (d) => set({ day: Math.max(0, Math.min(180, Math.round(d))) }),
      setAstronaut: (id) => {
        if (id === get().astronautId) return;
        set({ astronautId: id, ticks: [], level: null, prevLevel: null, selectedZone: null, levelSince: Date.now() });
      },
      selectZone: (z) => {
        if (get().painPick && z) { set({ pendingPainZone: z }); return; }
        set({ selectedZone: z });
      },
      pushTick: (t) => {
        const s = get();
        const normalized = {
          ...t,
          astronautId: t.astronautId?.replace(/^ASTRO-/i, 'astro-').toLowerCase(),
        };
        const ticks = s.ticks.length >= RING_SIZE ? [...s.ticks.slice(s.ticks.length - RING_SIZE + 1), normalized] : [...s.ticks, normalized];
        const now = Date.now();
        const patch: Partial<HealthState> = { ticks, lastTickAt: now, mode: 'live' };
        if (normalized.alertLevel !== s.level) {
          patch.prevLevel = s.level;
          patch.level = normalized.alertLevel;
          patch.levelSince = now;
          if (normalized.alertLevel === 'red' && s.level !== null) patch.redBannerAt = now;
          if (s.level !== null) {
            patch.audit = [{ at: now, text: `Alert level ${s.level.toUpperCase()} → ${normalized.alertLevel.toUpperCase()}` }, ...s.audit].slice(0, 200);
          }
        }
        set(patch);
      },
      log: (text) => set((s) => ({ audit: [{ at: Date.now(), text }, ...s.audit].slice(0, 200) })),
      ack: (key, snoozeMin) => {
        const at = Date.now();
        set((s) => ({
          acks: { ...s.acks, [key]: { at, snoozeUntil: snoozeMin ? at + snoozeMin * 60000 : undefined } },
          audit: [{ at, text: `${snoozeMin ? `Snoozed ${snoozeMin} min` : 'Acknowledged'}: ${key}` }, ...s.audit].slice(0, 200),
        }));
      },
      toggleStep: (key, idx, len) => set((s) => {
        const cur = s.protocolChecks[key] ?? Array(len).fill(false);
        const next = [...cur];
        next[idx] = !next[idx];
        const completed = next.every(Boolean) && !cur.every(Boolean);
        return {
          protocolChecks: { ...s.protocolChecks, [key]: next },
          xp: s.xp + (next[idx] ? 5 : 0) + (completed ? 25 : 0),
          audit: completed ? [{ at: Date.now(), text: `Protocol completed: ${key}` }, ...s.audit].slice(0, 200) : s.audit,
        };
      }),
      setOverride: (o) => set((s) => {
        const key = `${s.astronautId}:${s.day}`;
        const prev = s.overrides[key] ?? {};
        return {
          overrides: { ...s.overrides, [key]: { ...prev, ...o, pain: { ...(prev.pain ?? {}), ...(o.pain ?? {}) } } },
          audit: [{ at: Date.now(), text: `Manual entry saved for ${key}` }, ...s.audit].slice(0, 200),
        };
      }),
      escalate: (zone, text, oneWaySec) => {
        const at = Date.now();
        const e: Escalation = { id: `${at}`, at, zone, text, arriveAt: at + oneWaySec * 1000, replyAt: at + (oneWaySec * 2 + 120) * 1000 };
        set((s) => ({ escalations: [e, ...s.escalations].slice(0, 20), audit: [{ at, text: `Report queued to Mission Control: ${text}` }, ...s.audit].slice(0, 200) }));
      },
      toggleWhatIf: (id) => set((s) => ({ whatIfs: s.whatIfs.includes(id) ? s.whatIfs.filter((x) => x !== id) : [...s.whatIfs, id] })),
      completeTask: (taskId) => set((s) => {
        const key = `${s.astronautId}:${s.day}:${taskId}`;
        if (s.tasksDone[key]) return {};
        return { tasksDone: { ...s.tasksDone, [key]: true }, xp: s.xp + 10 };
      }),
    }),
    {
      name: 'astrocare-v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        envId: s.envId, overrides: s.overrides, muted: s.muted, acks: s.acks, audit: s.audit.slice(0, 50),
        protocolChecks: s.protocolChecks, tasksDone: s.tasksDone, xp: s.xp, glucoseUnit: s.glucoseUnit, earthMode: s.earthMode,
      }),
    },
  ),
);
