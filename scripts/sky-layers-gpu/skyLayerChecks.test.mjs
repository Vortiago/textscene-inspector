import { describe, expect, it } from 'vitest';
import {
  halfFloatTolerance,
  negativeFailure,
  skyLayerFailures,
  uniformSkyFailure,
} from './skyLayerChecks.mjs';

const RADIANCE = [0.25, 0.5, 1];
const rangeOf = (min, max, { layer = 0, mip = 0, nonFinite = 0 } = {}) => [
  { layer, mip, min, max, nonFinite },
];

describe('halfFloatTolerance', () => {
  it("allows layer 0's mip 0 one rounding step, for the octmap", () => {
    expect(halfFloatTolerance(0, 0)).toBe(2 ** -11);
  });

  it('allows a filtered layer the chain and the filter, and each mip its downsamples', () => {
    expect(halfFloatTolerance(3, 2)).toBe(10 * 2 ** -11);
  });

  it('allows the deepest mip of a filtered layer fourteen steps (edge case)', () => {
    expect(halfFloatTolerance(7, 6)).toBe(14 * 2 ** -11);
  });
});

describe('uniformSkyFailure', () => {
  it('passes layers that hold the sky colour in every texel', () => {
    expect(uniformSkyFailure('sky', rangeOf(RADIANCE, RADIANCE), RADIANCE)).toBeUndefined();
  });

  it('names the mip, the channel, the expected and the found value off the sky colour (error case)', () => {
    expect(uniformSkyFailure('sky', rangeOf([0.25, 0.4, 1], RADIANCE, { layer: 2, mip: 1 }), RADIANCE)).toBe(
      'sky, layer 2 mip 1: expected channel 1 at 0.5 in every texel, found 0.4'
    );
  });

  it("passes a texel off by its mip's tolerance, but no more (edge case)", () => {
    const tolerance = halfFloatTolerance(4, 3);
    const at = (blue) => rangeOf(RADIANCE, [0.25, 0.5, blue], { layer: 4, mip: 3 });

    expect(uniformSkyFailure('sky', at(1 + tolerance), RADIANCE)).toBeUndefined();
    expect(uniformSkyFailure('sky', at(1 + tolerance + 2 ** -11), RADIANCE)).toBeDefined();
  });

  it("holds layer 0's mip 0 to one step, which a deep mip may exceed (edge case)", () => {
    const twoSteps = [0.25, 0.5, 1 + 2 * 2 ** -11];

    expect(uniformSkyFailure('sky', rangeOf(RADIANCE, twoSteps), RADIANCE)).toBeDefined();
    expect(uniformSkyFailure('sky', rangeOf(RADIANCE, twoSteps, { mip: 1 }), RADIANCE)).toBeUndefined();
  });

  it('fails layers with a value that is not finite, which a degenerate frame writes (error case)', () => {
    expect(uniformSkyFailure('sky', rangeOf(RADIANCE, RADIANCE, { nonFinite: 3 }), RADIANCE)).toBe(
      'sky, layer 0 mip 0: expected finite values, found 3 that are not'
    );
  });
});

describe('negativeFailure', () => {
  it('passes layers no darker than black', () => {
    expect(negativeFailure('sky', rangeOf([0, 0, 0], [8, 8, 8]))).toBeUndefined();
  });

  it('names the mip and the darkest channel below zero (error case)', () => {
    expect(negativeFailure('sky', rangeOf([0, -0.02, -0.01], [8, 8, 8], { layer: 5 }))).toBe(
      'sky, layer 5 mip 0: expected no channel below 0, found -0.02'
    );
  });

  it('fails layers with a value that is not finite (edge case)', () => {
    expect(negativeFailure('sky', rangeOf([0, 0, 0], [8, 8, 8], { nonFinite: 1 }))).toBeDefined();
  });
});

describe('skyLayerFailures', () => {
  const passing = {
    uniformRadiance: RADIANCE,
    uniformImportance: rangeOf(RADIANCE, RADIANCE),
    uniformFast: rangeOf(RADIANCE, RADIANCE),
    highContrastFast: rangeOf([0, 0, 0], [8, 8, 8]),
  };

  it('finds nothing in layers that pass every check', () => {
    expect(skyLayerFailures(passing)).toEqual([]);
  });

  it('lists each failing bake by its sky and filter (error case)', () => {
    const failures = skyLayerFailures({ ...passing, highContrastFast: rangeOf([-1, 0, 0], [8, 8, 8]) });

    expect(failures).toEqual([
      'high-contrast sky, fast filter, layer 0 mip 0: expected no channel below 0, found -1',
    ]);
  });

  it('lists every failing bake when all fail (edge case)', () => {
    const off = rangeOf([0, 0, 0], RADIANCE);

    expect(skyLayerFailures({ ...passing, uniformImportance: off, uniformFast: off })).toHaveLength(2);
  });
});
