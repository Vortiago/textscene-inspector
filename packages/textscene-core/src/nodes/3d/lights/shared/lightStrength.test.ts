import { describe, expect, it } from 'vitest';
import {
  directionalLightSpecularAmount,
  lightShadowOpacity,
  positionalLightSpecularAmount,
  signedLightEnergy,
} from './lightStrength';

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

describe('positionalLightSpecularAmount', () => {
  it('doubles the authored light_specular', () => {
    expect(positionalLightSpecularAmount({ light_specular: 0.25 })).toBe(0.5);
  });

  it("reads Light3D's default of 0.5 as an amount of 1", () => {
    expect(positionalLightSpecularAmount({})).toBe(1);
  });

  it('keeps a zero specular at zero (edge case)', () => {
    expect(positionalLightSpecularAmount({ light_specular: 0 })).toBe(0);
  });
});

describe('directionalLightSpecularAmount', () => {
  it('takes the authored light_specular as it is', () => {
    expect(directionalLightSpecularAmount({ light_specular: 0.25 })).toBe(0.25);
  });

  it("reads DirectionalLight3D's own default of 1", () => {
    expect(directionalLightSpecularAmount({})).toBe(1);
  });

  it('keeps a specular past the hint range (edge case)', () => {
    expect(directionalLightSpecularAmount({ light_specular: 20 })).toBe(20);
  });
});
