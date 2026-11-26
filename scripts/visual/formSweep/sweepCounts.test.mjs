/** The four counts the lit surface sweep prints after its rows. */
import { describe, expect, it } from 'vitest';
import { sweepCounts } from './sweepCounts.mjs';

describe('sweepCounts', () => {
  it('counts a golden with no changed pixel as identical', () => {
    expect(sweepCounts([{ changedPixels: 0, maxChannelDelta: 0 }])).toEqual({
      identical: 1,
      withinOneStep: 0,
      aboveOneStep: 0,
      failed: 0,
    });
  });

  it('counts a golden that moved by 1/255 at most as within one step', () => {
    expect(sweepCounts([{ changedPixels: 40, maxChannelDelta: 1 }]).withinOneStep).toBe(1);
  });

  it('counts a golden that moved by 2/255 as above one step', () => {
    expect(sweepCounts([{ changedPixels: 1, maxChannelDelta: 2 }]).aboveOneStep).toBe(1);
  });

  it('counts a capture of another size as above one step', () => {
    const sizeMismatch = { expected: { width: 2, height: 2 }, actual: { width: 4, height: 2 } };

    expect(sweepCounts([{ sizeMismatch }]).aboveOneStep).toBe(1);
  });

  it('counts a scene that never settled as failed', () => {
    expect(sweepCounts([{ failed: 'no canvas appeared within 90s' }]).failed).toBe(1);
  });
});
