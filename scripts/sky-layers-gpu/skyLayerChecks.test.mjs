import { describe, expect, it } from 'vitest';
import {
  HALF_FLOAT_TOLERANCE,
  negativeFailure,
  skyLayerFailures,
  uniformSkyFailure,
} from './skyLayerChecks.mjs';

const RADIANCE = [0.25, 0.5, 1];
const rangeOf = (min, max, nonFinite = 0) => ({ min, max, nonFinite });

describe('uniformSkyFailure', () => {
  it('passes layers that hold the sky colour in every texel', () => {
    expect(uniformSkyFailure('sky', rangeOf(RADIANCE, RADIANCE), RADIANCE)).toBeUndefined();
  });

  it('names the channel, the expected and the found value of a layer off the sky colour (error case)', () => {
    expect(uniformSkyFailure('sky', rangeOf([0.25, 0.4, 1], RADIANCE), RADIANCE)).toBe(
      'sky: expected channel 1 at 0.5 in every texel, found 0.4'
    );
  });

  it('passes a texel off by the half-float tolerance, but no more (edge case)', () => {
    const atTolerance = 1 + HALF_FLOAT_TOLERANCE;
    const past = 1 + 2 * HALF_FLOAT_TOLERANCE;

    expect(uniformSkyFailure('sky', rangeOf(RADIANCE, [0.25, 0.5, atTolerance]), RADIANCE)).toBeUndefined();
    expect(uniformSkyFailure('sky', rangeOf(RADIANCE, [0.25, 0.5, past]), RADIANCE)).toBeDefined();
  });

  it('fails layers with a value that is not finite, which a degenerate frame writes (error case)', () => {
    expect(uniformSkyFailure('sky', rangeOf(RADIANCE, RADIANCE, 3), RADIANCE)).toBe(
      'sky: expected finite layers, found 3 values that are not'
    );
  });
});

describe('negativeFailure', () => {
  it('passes layers no darker than black', () => {
    expect(negativeFailure('sky', rangeOf([0, 0, 0], [8, 8, 8]))).toBeUndefined();
  });

  it('names the darkest channel below zero (error case)', () => {
    expect(negativeFailure('sky', rangeOf([0, -0.02, -0.01], [8, 8, 8]))).toBe(
      'sky: expected no channel below 0, found -0.02'
    );
  });

  it('fails layers with a value that is not finite (edge case)', () => {
    expect(negativeFailure('sky', rangeOf([0, 0, 0], [8, 8, 8], 1))).toBeDefined();
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

    expect(failures).toEqual(['high-contrast sky, fast filter: expected no channel below 0, found -1']);
  });

  it('lists every failing bake when all fail (edge case)', () => {
    const off = rangeOf([0, 0, 0], RADIANCE);

    expect(skyLayerFailures({ ...passing, uniformImportance: off, uniformFast: off })).toHaveLength(2);
  });
});
