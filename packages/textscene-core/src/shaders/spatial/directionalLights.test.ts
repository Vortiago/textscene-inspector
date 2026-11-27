import { describe, expect, it } from 'vitest';
import { hasDirectionalSoftShadowAngle, type DirectionalLight } from './directionalLights.js';

/** A light that only `hasDirectionalSoftShadowAngle` reads: its shadow's angle, or no shadow. */
const sun = (softShadowAngle?: number) =>
  (softShadowAngle === undefined ? {} : { shadow: { softShadowAngle } }) as unknown as DirectionalLight;

describe('hasDirectionalSoftShadowAngle', () => {
  it('holds when one shadow of the render has an angle', () => {
    expect(hasDirectionalSoftShadowAngle([sun(0), sun(0.2)])).toBe(true);
  });

  it('fails when every shadow has angle 0', () => {
    expect(hasDirectionalSoftShadowAngle([sun(0), sun(0)])).toBe(false);
  });

  it('fails for lights with no shadow, or none at all (edge case)', () => {
    expect([hasDirectionalSoftShadowAngle([sun()]), hasDirectionalSoftShadowAngle([])]).toEqual([
      false,
      false,
    ]);
  });
});
