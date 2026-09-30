import { describe, it, expect } from 'vitest';
import {
  directionalShadowSlice,
  directionalShadowSnapStep,
  directionalShadowTexelSize,
  pancakesCasters,
  texelPaddedRadius,
} from './directionalShadow.js';

describe('directionalShadowSlice', () => {
  it('pulls the far end in to the shadow max distance for a perspective camera', () => {
    expect(directionalShadowSlice(0.05, 4000, 80, false)).toEqual({ near: 0.05, far: 80 });
  });

  it('keeps the camera far plane when it is nearer than the shadow max distance', () => {
    expect(directionalShadowSlice(0.1, 50, 80, false)).toEqual({ near: 0.1, far: 50 });
  });

  it('ignores the shadow max distance for an orthogonal camera', () => {
    expect(directionalShadowSlice(0.05, 4000, 80, true)).toEqual({ near: 0.05, far: 4000 });
  });

  it('reads a zero shadow max distance as the camera far plane', () => {
    expect(directionalShadowSlice(0.05, 300, 0, false)).toEqual({ near: 0.05, far: 300 });
  });

  it('keeps the far end 0.001 past the near end (edge case)', () => {
    const slice = directionalShadowSlice(10, 20, 5, false);
    expect(slice.near).toBe(10);
    expect(slice.far).toBeCloseTo(10.001, 12);
  });

  it('passes a nan far plane through to the near floor (error case)', () => {
    // MIN and MAX answer their second operand when a comparison with nan fails.
    const slice = directionalShadowSlice(1, Number.NaN, 0, false);
    expect(slice.far).toBeCloseTo(1.001, 12);
    expect(slice.near).toBe(1);
  });
});

describe('texelPaddedRadius', () => {
  it('adds one texel on each side of the map', () => {
    expect(texelPaddedRadius(1023, 2048)).toBeCloseTo(1024, 9);
  });

  it('leaves a zero radius at zero (edge case)', () => {
    expect(texelPaddedRadius(0, 2048)).toBe(0);
  });

  it('answers infinity for a two-texel map (error case)', () => {
    expect(texelPaddedRadius(1, 2)).toBe(Infinity);
  });
});

describe('directionalShadowSnapStep', () => {
  it('is four radii over the map size', () => {
    expect(directionalShadowSnapStep(512, 2048)).toBe(1);
  });

  it('is zero for a zero radius, which snapped() reads as no snapping (edge case)', () => {
    expect(directionalShadowSnapStep(0, 2048)).toBe(0);
  });

  it('answers infinity for an empty map (error case)', () => {
    expect(directionalShadowSnapStep(1, 0)).toBe(Infinity);
  });
});

describe('directionalShadowTexelSize', () => {
  it('is the map diameter over its size', () => {
    expect(directionalShadowTexelSize(1024, 4096)).toBe(0.5);
  });

  it('is zero for a zero radius (edge case)', () => {
    expect(directionalShadowTexelSize(0, 4096)).toBe(0);
  });

  it('answers infinity for an empty map (error case)', () => {
    expect(directionalShadowTexelSize(1, 0)).toBe(Infinity);
  });
});

describe('pancakesCasters', () => {
  it('pancakes for a positive pancake size', () => {
    expect(pancakesCasters(20)).toBe(true);
  });

  it('does not pancake at zero (edge case)', () => {
    expect(pancakesCasters(0)).toBe(false);
  });

  it('does not pancake for nan (error case)', () => {
    expect(pancakesCasters(Number.NaN)).toBe(false);
  });
});
