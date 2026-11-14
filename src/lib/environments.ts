export type EnvironmentId = 'iss' | 'gateway' | 'lunar_base' | 'mars_transit' | 'mars_base' | 'rover';

export interface EnvironmentProfile {
  id: EnvironmentId;
  label: string;
  short: string;
  gravityG: number;
  /** one-way signal delay in seconds (worst case) */
  delaySec: number;
  /** multiplier on ISS-like daily radiation dose */
  radiationMult: number;
  /** multiplier on bone-loss rate (partial gravity helps a bit — demo assumption) */
  boneMult: number;
  risks: string[];
  sky: [string, string]; // gradient colors for 3D background
}

export const ENVIRONMENTS: EnvironmentProfile[] = [
  { id: 'iss', label: 'ISS — Low Earth Orbit', short: 'ISS', gravityG: 0, delaySec: 0.5, radiationMult: 1, boneMult: 1,
    risks: ['Microgravity fluid shift', 'Bone & muscle loss', 'CO₂ build-up', 'Sleep disruption'], sky: ['#0B1220', '#0B1220'] },
  { id: 'gateway', label: 'Orion / Gateway transit', short: 'Gateway', gravityG: 0, delaySec: 1.3, radiationMult: 2.5, boneMult: 1,
    risks: ['Deep-space radiation (GCR)', 'Solar particle events', 'Confinement'], sky: ['#06061A', '#1E1B4B'] },
  { id: 'lunar_base', label: 'Lunar surface base', short: 'Moon', gravityG: 0.16, delaySec: 1.3, radiationMult: 2, boneMult: 0.85,
    risks: ['Lunar dust (lungs, eyes)', 'EVA injury', 'Decompression sickness', 'Partial-gravity adaptation'], sky: ['#0A0A0F', '#2A2A35'] },
  { id: 'mars_transit', label: 'Mars transit', short: 'Mars transit', gravityG: 0, delaySec: 1320, radiationMult: 3, boneMult: 1,
    risks: ['22-min comm delay → autonomous care', 'GCR radiation', 'Isolation', 'SANS'], sky: ['#0A0510', '#3B0D1A'] },
  { id: 'mars_base', label: 'Mars surface base', short: 'Mars', gravityG: 0.38, delaySec: 1320, radiationMult: 1.2, boneMult: 0.6,
    risks: ['Autonomous medical care', 'Dust & perchlorates', 'EVA injury', 'Re-adaptation to 0.38 g'], sky: ['#1A0805', '#5C1F0F'] },
  { id: 'rover', label: 'Pressurized rover (EVA-heavy)', short: 'Rover', gravityG: 0.16, delaySec: 1.3, radiationMult: 2, boneMult: 0.85,
    risks: ['Decompression sickness', 'Hypoxia', 'EVA injury (hands, shoulders)', 'Confined space CO₂'], sky: ['#0A0A0F', '#33281A'] },
];

export const envById = (id: EnvironmentId) => ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[0];
