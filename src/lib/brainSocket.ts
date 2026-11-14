import { parseTick, type BrainTick, type ConnectionState } from '@/types/brain';
import { buildMockTick, type MockContext } from './brainMock';

export interface BrainClientOptions {
  url?: string;
  onTick: (t: BrainTick) => void;
  onState: (s: ConnectionState) => void;
  onMode: (m: 'live' | 'mock') => void;
  /** current context for the in-browser mock generator; return null to pause (simulated signal loss) */
  getMockContext: () => Omit<MockContext, 'seq'> | null;
  tickMs?: number;
}

/**
 * Connects to the backend brain over WebSocket with exponential back-off (1 s → 30 s).
 * While no backend is reachable, an in-browser mock emits ticks with the same contract.
 */
export function startBrain(opts: BrainClientOptions): () => void {
  const tickMs = opts.tickMs ?? 1000;
  let ws: WebSocket | null = null;
  let backoff = 1000;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let mockTimer: ReturnType<typeof setInterval> | null = null;
  let seq = 0;
  let stopped = false;

  const emitMock = () => {
    const ctx = opts.getMockContext();
    if (!ctx) return; // paused → no ticks → freshness indicator turns yellow/gray
    opts.onTick(buildMockTick({ ...ctx, seq: ++seq, jitter: true }));
  };
  const startMock = () => {
    if (mockTimer) return;
    opts.onMode('mock');
    emitMock();
    mockTimer = setInterval(emitMock, tickMs);
  };
  const stopMock = () => {
    if (mockTimer) clearInterval(mockTimer);
    mockTimer = null;
  };

  const connect = () => {
    if (stopped || !opts.url) return;
    opts.onState(ws ? 'reconnecting' : 'connecting');
    try {
      ws = new WebSocket(opts.url);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      backoff = 1000;
      stopMock();
      opts.onMode('live');
      opts.onState('live');
    };
    ws.onmessage = (ev) => {
      try {
        const t = parseTick(JSON.parse(String(ev.data)));
        if (t) opts.onTick(t);
      } catch (e) {
        console.warn('[brain] non-JSON message ignored', e);
      }
    };
    ws.onclose = () => { if (!stopped) scheduleReconnect(); };
    ws.onerror = () => ws?.close();
  };

  const scheduleReconnect = () => {
    opts.onState('reconnecting');
    startMock();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, backoff);
    backoff = Math.min(30000, backoff * 2);
  };

  if (opts.url) connect();
  else { opts.onState('offline'); startMock(); }

  return () => {
    stopped = true;
    stopMock();
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  };
}
