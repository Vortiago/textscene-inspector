import { describe, expect, it } from 'vitest';
import { LIGHT_INTENSITY_SCALE } from '../../../../r3f/lightConstants';
import { lightIntensity, lightShadowOpacity, signedLightEnergy } from './lightStrength';

describe('signedLightEnergy', () => {
  it('keeps the energy of a light that is not negative', () => {
    expect(signedLightEnergy({ light_energy: 2 })).toBe(2);
  });

  it('negates the energy of a negative light', () => {
    expect(signedLightEnergy({ light_energy: 2, light_negative: true })).toBe(-2);
  });

  it('keeps a zero energy at zero whatever the sign (edge case)', () => {
    expect(Math.abs(signedLightEnergy({ light_energy: 0, light_negative: true }))).toBe(0);
  });
});

describe('lightIntensity', () => {
  it('scales the energy into three intensity', () => {
    expect(lightIntensity({ light_energy: 2 })).toBeCloseTo(2 * LIGHT_INTENSITY_SCALE, 10);
  });

  it('subtracts for a negative light', () => {
    expect(lightIntensity({ light_energy: 1, light_negative: true })).toBeCloseTo(-LIGHT_INTENSITY_SCALE, 10);
  });

  it('keeps the sign of a negative energy on a light that is not negative (edge case)', () => {
    expect(lightIntensity({ light_energy: -1, light_negative: false })).toBeCloseTo(
      -LIGHT_INTENSITY_SCALE,
      10
    );
  });
});

describe('lightShadowOpacity', () => {
  it('takes the authored shadow opacity', () => {
    expect(lightShadowOpacity({ shadow_opacity: 0.25 })).toBe(0.25);
  });

  it("takes Light3D's default of 1 when the scene stores none", () => {
    expect(lightShadowOpacity({})).toBe(1);
  });

  it('keeps an opacity of 0, which is not absent (edge case)', () => {
    expect(lightShadowOpacity({ shadow_opacity: 0 })).toBe(0);
  });
});
