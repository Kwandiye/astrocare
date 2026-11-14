import { CircleCheck, AlertTriangle, OctagonX, WifiOff, type LucideIcon } from 'lucide-react';
import type { TriageStatus } from '@/types/health';

/**
 * One colour per meaning, used everywhere (cards, 3D body, charts):
 * green = normal · amber = warning · red = critical · grey = no data. Blue is for neutral information.
 */
export const STATUS_META: Record<TriageStatus, { color: string; label: string; word: string; icon: LucideIcon; bg: string }> = {
  green: { color: '#22C55E', label: 'Normal', word: 'STABLE', icon: CircleCheck, bg: 'rgba(34,197,94,0.12)' },
  yellow: { color: '#F59E0B', label: 'Warning', word: 'WARNING', icon: AlertTriangle, bg: 'rgba(245,158,11,0.13)' },
  red: { color: '#EF4444', label: 'Critical', word: 'CRITICAL', icon: OctagonX, bg: 'rgba(239,68,68,0.14)' },
  stale: { color: '#64748B', label: 'No data', word: 'NO SIGNAL', icon: WifiOff, bg: 'rgba(100,116,139,0.16)' },
};

export const INFO = '#38BDF8';
export const RAD_COLOR = '#A78BFA';
export const HOLO = '#38BDF8';
export const NEUTRAL_ZONE = '#22C55E';
export const FG = '#F5F7FA';
export const FG_MUTED = '#94A3B8';
