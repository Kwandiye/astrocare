'use client';
import { useHealthStore } from '@/store/useHealthStore';

/** Earth dual-use relabeling (remote stations / Antarctica / telemedicine). */
export function useLabels() {
  const earth = useHealthStore((s) => s.earthMode);
  return earth
    ? { mc: 'Telemedicine hub', surgeon: 'remote physician', cmo: 'station medic', mission: 'Antarctic station — winter-over', crew: 'Team', astronaut: 'expeditioner' }
    : { mc: 'Mission Control', surgeon: 'flight surgeon', cmo: 'Crew Medical Officer', mission: 'Expedition AX-26', crew: 'Crew', astronaut: 'astronaut' };
}
