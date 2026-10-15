import { describe, expect, it } from 'vitest';
import {
  directionalLightSize,
  drawsDirectionalSoftShadow,
  softShadowAngle,
  softShadowExpand,
} from './directionalSoftShadow';

describe('softShadowAngle', () => {
  it('is the tangent of the angular distance', () => {
    expect(softShadowAngle(45)).toBeCloseTo(1, 12);
  });

  it('is zero for no angular distance (edge case)', () => {
    expect(softShadowAngle(0)).toBe(0);
  });

  it('is zero for a negative angular distance, which Godot treats as none (error case)', () => {
    expect(softShadowAngle(-5)).toBe(0);
  });
});

describe('drawsDirectionalSoftShadow', () => {
  it('holds for a shadowed light with an angular distance and a blur', () => {
    expect(
      drawsDirectionalSoftShadow({
        angularDistance: 2,
        shadowEnabled: true,
        shadowBlur: 1,
        lightsSurfaces: true,
      })
    ).toBe(true);
  });

  it('does not hold without a blur (edge case)', () => {
    expect(
      drawsDirectionalSoftShadow({
        angularDistance: 2,
        shadowEnabled: true,
        shadowBlur: 0,
        lightsSurfaces: true,
      })
    ).toBe(false);
  });

  it('does not hold for a Sky Only light, which the scene skips (edge case)', () => {
    expect(
      drawsDirectionalSoftShadow({
        angularDistance: 2,
        shadowEnabled: true,
        shadowBlur: 1,
        lightsSurfaces: false,
      })
    ).toBe(false);
  });

  it('does not hold without a shadow or an angular distance (error case)', () => {
    expect(
      drawsDirectionalSoftShadow({
        angularDistance: 2,
        shadowEnabled: false,
        shadowBlur: 1,
        lightsSurfaces: true,
      })
    ).toBe(false);
    expect(
      drawsDirectionalSoftShadow({
        angularDistance: 0,
        shadowEnabled: true,
        shadowBlur: 1,
        lightsSurfaces: true,
      })
    ).toBe(false);
  });
});

describe('directionalLightSize', () => {
  it('is one minus the cosine of the angular distance', () => {
    expect(directionalLightSize(60)).toBeCloseTo(0.5, 12);
  });

  it('is zero for no angular distance (edge case)', () => {
    expect(directionalLightSize(0)).toBe(0);
  });

  it('is one for a right angle, the top of the range (error case)', () => {
    expect(directionalLightSize(90)).toBeCloseTo(1, 12);
  });
});

describe('softShadowExpand', () => {
  it('widens the box by the angle over the depth range', () => {
    expect(softShadowExpand(0.5, 30)).toBe(15);
  });

  it('is zero for no angle (edge case)', () => {
    expect(softShadowExpand(0, 30)).toBe(0);
  });

  it('is zero for an empty depth range (error case)', () => {
    expect(softShadowExpand(0.5, 0)).toBe(0);
  });
});
