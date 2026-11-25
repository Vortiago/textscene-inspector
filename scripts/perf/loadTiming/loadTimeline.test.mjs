import { describe, expect, it } from 'vitest';
import { eventLine, isPrinted, LoadTimeline } from './loadTimeline.mjs';

const NAVIGATE = { at: 20, kind: 'navigate', search: '?fixture=lit.tscn' };
const CANVAS = { at: 480, kind: 'canvas' };
const LIT_DRAW = { at: 3000, kind: 'first-draw', ms: 650, shaderLengths: [49225, 195746] };
const SKY_DRAW = { at: 700, kind: 'first-draw', ms: 16, shaderLengths: [1982, 10384] };
const COMPILE_TASK = { at: 14000, kind: 'long-task', ms: 12047, from: 1934 };
const FRAME_TASK = { at: 14300, kind: 'long-task', ms: 260, from: 14040 };

describe('eventLine', () => {
  it('names a first draw with its time and the length of each shader', () => {
    expect(eventLine(LIT_DRAW)).toBe('3000 ms first draw 650 ms, shader lengths 49225 + 195746');
  });

  it('names a main-thread task with its length and start', () => {
    expect(eventLine(COMPILE_TASK)).toBe('14000 ms main-thread task 12047 ms from 1934 ms');
  });

  it('refuses an event kind the recorder does not write', () => {
    expect(() => eventLine({ at: 0, kind: 'paint' })).toThrow('got kind paint');
  });
});

describe('isPrinted', () => {
  it('prints a long task of a second or more', () => {
    expect(isPrinted(COMPILE_TASK)).toBe(true);
  });

  it('leaves out an ordinary frame', () => {
    expect(isPrinted(FRAME_TASK)).toBe(false);
  });
});

describe('LoadTimeline', () => {
  it('sums up a load', () => {
    const timeline = new LoadTimeline();
    for (const event of [NAVIGATE, CANVAS, SKY_DRAW, LIT_DRAW, COMPILE_TASK, FRAME_TASK]) timeline.add(event);
    expect(timeline.summary()).toBe(
      '?fixture=lit.tscn: canvas inserted at 480 ms, 2 programs drawn, the slowest first draw 650 ms, ' +
        '1 main-thread tasks over 1000 ms, the longest 12047 ms'
    );
  });

  it('answers the summary of the load a navigation ends', () => {
    const timeline = new LoadTimeline();
    timeline.add(NAVIGATE);
    timeline.add(CANVAS);
    const ended = timeline.add({ ...NAVIGATE, search: '?fixture=next.tscn' });
    expect(ended).toMatch(/^\?fixture=lit\.tscn: canvas inserted at 480 ms/);
  });

  it('starts a new load at a navigation', () => {
    const timeline = new LoadTimeline();
    timeline.add(NAVIGATE);
    timeline.add(CANVAS);
    timeline.add({ ...NAVIGATE, search: '?fixture=next.tscn' });
    expect(timeline.summary()).toMatch(/^\?fixture=next\.tscn: canvas inserted at no time, 0 programs/);
  });

  it('answers no summary for an event that is not a navigation', () => {
    expect(new LoadTimeline().add(CANVAS)).toBeNull();
  });

  it('leaves out an event that comes before the first navigation', () => {
    const timeline = new LoadTimeline();
    timeline.add(CANVAS);
    expect(timeline.summary()).toBeNull();
  });

  it('has no summary before the first navigation', () => {
    expect(new LoadTimeline().summary()).toBeNull();
  });
});
