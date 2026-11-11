import { describe, it, expect } from 'vitest';
import { coveredBins } from './shadowMapRaster';

describe('coveredBins', () => {
  it('snaps an end within half of 1/256 px onto a centre before the test, as lavapipe does', () => {
    expect(coveredBins(2.5 + 0.0015, 5.5 - 0.0015)).toEqual({ first: 2, last: 4 });
    expect(coveredBins(2.5 + 0.0025, 5.5 + 0.0025)).toEqual({ first: 3, last: 5 });
  });
});
