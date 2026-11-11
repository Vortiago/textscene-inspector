import { describe, it, expect } from 'vitest';
import { coveredBins } from './shadowMapRaster';

describe('coveredBins', () => {
  it('takes the bins whose centres lie in [left, right)', () => {
    expect(coveredBins(2.5, 5.5)).toEqual([2, 4]);
  });

  it('snaps an end within half of 1/256 px onto a centre before the test, as lavapipe does', () => {
    expect(coveredBins(2.5 + 0.0015, 5.5 - 0.0015)).toEqual([2, 4]);
    expect(coveredBins(2.5 + 0.0025, 5.5 + 0.0025)).toEqual([3, 5]);
  });

  it('covers no bin when both ends lie between the same two centres', () => {
    const [first, last] = coveredBins(3.6, 4.4);
    expect(last).toBeLessThan(first);
  });
});
