/**
 * SpriteFrames playback lookup: playhead → displayed frame, including the
 * degenerate animations a lenient parser can produce.
 */
import { describe, it, expect } from 'vitest';
import { clipDuration, frameAtTime } from './playback';
import type { SpriteFramesAnimation } from './types';

const make = (
  frames: number,
  fps: number,
  loop: boolean,
  durations?: number[]
): SpriteFramesAnimation => ({
  name: 'a',
  frames: Array.from({ length: frames }, (_, i) => `f${i}`),
  durations: durations ?? Array.from({ length: frames }, () => 1),
  fps,
  loop,
});

describe('frameAtTime', () => {
  it('starts on frame 0 at t=0', () => {
    expect(frameAtTime(make(3, 5, true), 0)).toBe(0);
  });

  it('advances one frame per 1/fps seconds', () => {
    const a = make(4, 5, true); // 0.2s per frame
    expect(frameAtTime(a, 0.1)).toBe(0);
    expect(frameAtTime(a, 0.25)).toBe(1);
    expect(frameAtTime(a, 0.45)).toBe(2);
  });

  it('loops back to the start after the last frame when loop=true', () => {
    const a = make(2, 5, true); // total 0.4s
    expect(frameAtTime(a, 0.41)).toBe(0); // wrapped
    expect(frameAtTime(a, 0.61)).toBe(1);
  });

  it('holds the final frame when loop=false', () => {
    const a = make(3, 5, false); // total 0.6s
    expect(frameAtTime(a, 5)).toBe(2);
  });

  it('honours per-frame durations', () => {
    const a = make(2, 1, true, [2, 1]); // frame0 shows 2s, frame1 shows 1s
    expect(frameAtTime(a, 1.5)).toBe(0);
    expect(frameAtTime(a, 2.5)).toBe(1);
  });

  it('stays on frame 0 for a single-frame or zero-fps animation', () => {
    expect(frameAtTime(make(1, 5, true), 3)).toBe(0);
    expect(frameAtTime(make(4, 0, true), 3)).toBe(0);
  });

  it('stays on frame 0 for a negative playhead', () => {
    expect(frameAtTime(make(3, 5, true), -1)).toBe(0);
  });

  it('returns frame 0 (not the last frame) when a duration is NaN — no stall', () => {
    const bad = make(2, 5, true, [NaN, 1]);
    // Without the NaN-aware total guard this returns n-1 and freezes there.
    expect(frameAtTime(bad, 3)).toBe(0);
  });
});

describe('clipDuration', () => {
  it('sums the per-frame display times', () => {
    expect(clipDuration(make(4, 5, true))).toBeCloseTo(0.8, 6);
    expect(clipDuration(make(2, 1, true, [2, 1]))).toBeCloseTo(3, 6);
  });

  it('is zero for a zero or negative fps (nothing to play)', () => {
    expect(clipDuration(make(3, 0, true))).toBe(0);
    expect(clipDuration(make(3, -5, true))).toBe(0);
  });

  it('is zero for an animation with no frames', () => {
    expect(clipDuration(make(0, 5, true))).toBe(0);
  });
});
