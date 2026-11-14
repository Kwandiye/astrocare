/** Communication-delay helpers for the escalation UX. */
export function fmtDuration(sec: number): string {
  if (sec < 1) return `${Math.round(sec * 1000)} ms`;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')} min`;
}

/** Earth needs time to read and answer (assume ~2 min for a flight surgeon to respond). */
export const replyExpectedSec = (oneWaySec: number) => oneWaySec * 2 + 120;

export const isAutonomous = (oneWaySec: number) => oneWaySec > 60;
