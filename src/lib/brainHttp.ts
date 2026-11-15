import type { BrainTick } from '@/types/brain';

const baseUrl = () => process.env.NEXT_PUBLIC_BRAIN_HTTP_URL || 'http://localhost:8765';

export interface AskResponse {
  answer: string;
  source: 'llm' | 'fallback';
  disclaimer: string;
  contextTimestamp?: string;
}

export interface MissionReport {
  astronautId: string;
  timeByLevel: Record<'green' | 'yellow' | 'red', number>;
  episodes: number;
  conditionsSeen: { code: string; episodes: number; totalSeconds: number }[];
  flagsSeen: string[];
  missingResourcesEverNeeded?: string[];
  note?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `Brain request failed (${response.status})`);
    return payload as T;
  } finally {
    window.clearTimeout(timer);
  }
}

export function postAsk(astronautId: string, question: string): Promise<AskResponse> {
  return request<AskResponse>('/ask', {
    method: 'POST',
    body: JSON.stringify({ astronaut_id: astronautId, question }),
  });
}

export function getReport(astronautId: string): Promise<MissionReport> {
  return request<MissionReport>(`/report?astronaut_id=${encodeURIComponent(astronautId)}`);
}

export function isLiveTick(tick: BrainTick | null): boolean {
  return Boolean(tick?.doctorSource || tick?.bodySystems || tick?.flagDetails);
}
