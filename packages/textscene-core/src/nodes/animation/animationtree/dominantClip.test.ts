import { describe, expect, it } from 'vitest';
import type { AnimationAction } from 'three';
import { dominantActionTime, dominantClip } from './dominantClip';

describe('dominantClip', () => {
  it('picks the heaviest clip of a blend', () => {
    const program = [
      { clip: 'left', weight: 0.25 },
      { clip: 'right', weight: 0.75 },
    ];
    expect(dominantClip(program)).toBe(program[1]);
  });

  it('returns null for an empty program', () => {
    expect(dominantClip([])).toBeNull();
  });

  it('keeps the first of two equal weights (edge case)', () => {
    const program = [
      { clip: 'left', weight: 0.5 },
      { clip: 'right', weight: 0.5 },
    ];
    expect(dominantClip(program)).toBe(program[0]);
  });
});

describe('dominantActionTime', () => {
  function makeAction(time: number): AnimationAction {
    return { time } as AnimationAction;
  }

  it('returns null when there is no dominant clip', () => {
    expect(dominantActionTime(null, new Map())).toBeNull();
  });

  it("returns the dominant clip's action time when resolved", () => {
    const actions = new Map([['left', makeAction(0.42)]]);
    expect(dominantActionTime({ clip: 'left' }, actions)).toBe(0.42);
  });

  it('returns null (never a fabricated 0) when the dominant clip has no resolved action', () => {
    // A blend program can name a clip the resolved driver does not carry: the mount effect's
    // `clips.find` builds no action for it, so `dominant` is set but `actions` has no entry.
    const actions = new Map([['left', makeAction(0.1)]]);
    expect(dominantActionTime({ clip: 'right' }, actions)).toBeNull();
  });

  it('returns 0 for a resolved action that is genuinely at time 0 (edge case)', () => {
    // An action at time 0 flushes as 0, and no action skips the flush: a `?? 0` fallback would
    // conflate the two.
    const actions = new Map([['left', makeAction(0)]]);
    expect(dominantActionTime({ clip: 'left' }, actions)).toBe(0);
  });
});
