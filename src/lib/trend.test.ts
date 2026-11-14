import { describe, it, expect } from 'vitest';
import { slope, arrowFor, classifyFlag, trendDurationTicks, downsample, isHarmfulDirection } from './trend';
import { parseTick } from '@/types/brain';
import { buildMockTick, scenarioTick } from './brainMock';

describe('trend math', () => {
  it('slope of a line', () => expect(slope([1, 2, 3, 4, 5])).toBeCloseTo(1));
  it('flat → arrow →', () => expect(arrowFor(slope([70, 70.2, 69.9, 70.1]), 0.5)).toBe('→'));
  it('strong rise → ↑', () => expect(arrowFor(2, 0.5)).toBe('↑'));
  it('mild fall → ↘', () => expect(arrowFor(-0.8, 0.5)).toBe('↘'));
  it('rising duration counts ticks', () => {
    const v = [...Array(10).fill(70), ...Array.from({ length: 12 }, (_, i) => 70 + i * 2)];
    expect(trendDurationTicks(v, 0.5)).toBeGreaterThan(5);
  });
  it('harmful direction', () => {
    expect(isHarmfulDirection('↓', 'down')).toBe(true);
    expect(isHarmfulDirection('↑', 'down')).toBe(false);
  });
  it('spike vs sustained', () => {
    expect(classifyFlag([true, true, false, true, true])).toBe('single spike');
    expect(classifyFlag([true, false, false, false, false, false])).toBe('sustained');
    expect(classifyFlag([true, true, false])).toBe('new');
  });
  it('downsample', () => expect(downsample([1, 3, 5, 7], 2)).toEqual([2, 6]));
});

describe('brain contract', () => {
  it('mock tick validates against zod schema', () => {
    const t = buildMockTick({ astronautId: 'astro-01', day: 53, seq: 1 });
    expect(parseTick(JSON.parse(JSON.stringify(t)))).not.toBeNull();
    expect(t.alertLevel).toBe('red');
    expect(t.activeFlags.some((f) => f.zone === 'lungs' && f.severity === 'critical')).toBe(true);
  });
  it('scenario goes green → yellow → red', () => {
    expect(scenarioTick(0).alertLevel).toBe('green');
    expect(scenarioTick(45).alertLevel).toBe('yellow');
    expect(scenarioTick(85).alertLevel).toBe('red');
    expect(parseTick(scenarioTick(85))).not.toBeNull();
  });
  it('malformed tick is rejected, not thrown', () => {
    expect(parseTick({ alertLevel: 'purple' })).toBeNull();
  });
});
