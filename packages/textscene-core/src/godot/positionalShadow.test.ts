import { describe, expect, it } from 'vitest';
import {
  POSITIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
  positionalLightBounds,
  positionalShadowNear,
  positionalShadowNormalBias,
  spotShadowDepthBias,
} from './positionalShadow';

describe('positionalShadowNear', () => {
  it('renders from 0.025 for any range longer than that', () => {
    expect(positionalShadowNear(8)).toBe(0.025);
  });

  it('takes the range when it is shorter (edge case)', () => {
    expect(positionalShadowNear(0.01)).toBe(0.01);
  });

  it('passes a non-finite range through (error case)', () => {
    expect(positionalShadowNear(Number.NaN)).toBeNaN();
  });
});

describe('positionalShadowNormalBias', () => {
  it('is the default bias times ten texels of the largest root slot', () => {
    expect(positionalShadowNormalBias(POSITIONAL_SHADOW_NORMAL_BIAS_DEFAULT, 1024)).toBeCloseTo(
      10 / 1024,
      12
    );
  });

  it('doubles when the slot halves', () => {
    expect(positionalShadowNormalBias(1, 512)).toBeCloseTo(2 * positionalShadowNormalBias(1, 1024), 12);
  });

  it('is zero for a light with no normal bias (edge case)', () => {
    expect(positionalShadowNormalBias(0, 1024)).toBe(0);
  });

  it('is infinite for a slot of no texels (error case)', () => {
    expect(positionalShadowNormalBias(1, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('spotShadowDepthBias', () => {
  it('is the default bias over 100 times the default soft shadow scale', () => {
    expect(spotShadowDepthBias(0.03, 2)).toBeCloseTo(0.0006, 12);
  });

  it('is zero for a light with no blur (edge case)', () => {
    expect(spotShadowDepthBias(0.03, 0)).toBe(0);
  });

  it('passes a non-finite bias through (error case)', () => {
    expect(spotShadowDepthBias(Number.NaN, 2)).toBeNaN();
  });
});

describe('positionalLightBounds', () => {
  it('is a cube of the range round an omni light', () => {
    expect(positionalLightBounds(5, null)).toEqual({ min: [-5, -5, -5], max: [5, 5, 5] });
  });

  it('is the cone along -Z for a spot light', () => {
    const { min, max } = positionalLightBounds(10, 30);
    expect(min[0]).toBeCloseTo(-5, 12);
    expect(min[2]).toBe(-10);
    expect(max[1]).toBeCloseTo(5, 12);
    expect(max[2]).toBe(0);
  });

  it('is the whole cube for a spot light wider than a hemisphere (edge case)', () => {
    expect(positionalLightBounds(2, 100)).toEqual({ min: [-2, -2, -2], max: [2, 2, 2] });
  });

  it('carries a non-finite angle into the box (error case)', () => {
    expect(positionalLightBounds(2, Number.NaN).min[0]).toBeNaN();
  });
});
