import { describe, expect, it } from 'vitest';
import {
  areaLightBounds,
  areaLightShadowCoverageRadius,
  areaLightShadowDepthScale,
  areaLightShadowFar,
} from './areaLightShadow';

const size = { x: 2, y: 1 };

describe('areaLightShadowFar', () => {
  it('is the range plus half the diagonal of the rectangle', () => {
    expect(areaLightShadowFar(6, size)).toBeCloseTo(7.118033988749895, 12);
  });

  it('is half the diagonal for a light without a range (edge case)', () => {
    expect(areaLightShadowFar(0, size)).toBeCloseTo(1.118033988749895, 12);
  });

  it('is zero for a point light without a range (error case)', () => {
    expect(areaLightShadowFar(0, { x: 0, y: 0 })).toBe(0);
  });
});

describe('areaLightShadowDepthScale', () => {
  it('is one over the far plane the map renders to', () => {
    expect(areaLightShadowDepthScale(6, size)).toBeCloseTo(1 / 7.118033988749895, 12);
  });

  it('reads a range below a millimetre as a millimetre (edge case)', () => {
    expect(areaLightShadowDepthScale(0, { x: 0, y: 0 })).toBeCloseTo(1000, 9);
  });
});

describe('areaLightBounds', () => {
  it("is the range in front of the light, widened by the rectangle's half sides", () => {
    expect(areaLightBounds(6, size)).toEqual({ min: [-7, -6.5, -6], max: [7, 6.5, 0] });
  });

  it('is the rectangle itself for a light without a range (edge case)', () => {
    expect(areaLightBounds(0, size)).toEqual({ min: [-1, -0.5, -0], max: [1, 0.5, 0] });
  });
});

describe('areaLightShadowCoverageRadius', () => {
  it('is the range plus the whole diagonal', () => {
    expect(areaLightShadowCoverageRadius(6, size)).toBeCloseTo(8.23606797749979, 12);
  });

  it('is the range for a point light (edge case)', () => {
    expect(areaLightShadowCoverageRadius(3, { x: 0, y: 0 })).toBe(3);
  });
});
