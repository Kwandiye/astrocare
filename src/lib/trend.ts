/** Trend math over the tick history (the brain sends only the current state). */

export type TrendArrow = '↑' | '↗' | '→' | '↘' | '↓';

/** Least-squares slope (units per tick). */
export function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - mx) * (values[i] - my);
    den += (i - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Arrow from slope with a dead-band; strong = 3× dead-band. */
export function arrowFor(s: number, deadBand: number): TrendArrow {
  if (Math.abs(s) <= deadBand) return '→';
  if (s > 0) return s > deadBand * 3 ? '↑' : '↗';
  return s < -deadBand * 3 ? '↓' : '↘';
}

/** How many most-recent ticks have moved in the same direction as the overall trend. */
export function trendDurationTicks(values: number[], deadBand: number): number {
  const s = slope(values.slice(-15));
  if (Math.abs(s) <= deadBand) return 0;
  const dir = Math.sign(s);
  let count = 0;
  for (let i = values.length - 1; i >= 4; i--) {
    const local = slope(values.slice(i - 4, i + 1));
    if (Math.sign(local) === dir && Math.abs(local) > deadBand * 0.5) count++;
    else break;
  }
  return count;
}

/** Is a direction harmful? `bad` describes which direction moves toward danger. */
export function isHarmfulDirection(arrow: TrendArrow, bad: 'up' | 'down' | 'both'): boolean {
  if (arrow === '→') return false;
  const up = arrow === '↑' || arrow === '↗';
  return bad === 'both' ? true : bad === 'up' ? up : !up;
}

/**
 * Spike vs sustained: a flag is a "single spike" if, after it appeared, the value returned to range within 3 ticks.
 * `inRange` = per-tick boolean history (oldest first) for that metric.
 */
export function classifyFlag(inRange: boolean[]): 'single spike' | 'sustained' | 'new' {
  const lastBad = inRange.lastIndexOf(false);
  if (lastBad === -1) return 'single spike';
  // count consecutive out-of-range ticks ending at lastBad
  let run = 0;
  for (let i = lastBad; i >= 0 && !inRange[i]; i--) run++;
  const ticksSince = inRange.length - 1 - lastBad;
  if (ticksSince > 0 && run <= 3) return 'single spike';
  if (run > 3) return 'sustained';
  return 'new';
}

export function fmtAgo(sec: number): string {
  if (sec < 60) return `${Math.max(0, Math.round(sec))} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return `${m}:${s.toString().padStart(2, '0')}`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Downsample tick values into buckets of `size` (averages). */
export function downsample(values: number[], size: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < values.length; i += size) {
    const chunk = values.slice(i, i + size);
    out.push(chunk.reduce((s, v) => s + v, 0) / chunk.length);
  }
  return out;
}

/** Simple linear projection n steps ahead with probability-ish risk of crossing a threshold. */
export function forecast(values: number[], steps: number): number[] {
  const s = slope(values);
  const last = values[values.length - 1] ?? 0;
  return Array.from({ length: steps }, (_, i) => last + s * (i + 1));
}
