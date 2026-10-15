import { describe, it, expect } from 'vitest';
import {
  DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT,
  directionalLightDrawsInSky,
  directionalLightLightsSurfaces,
} from './directionalLightSkyMode.js';

/** `DirectionalLight3D::SkyMode` values a scene stores (`scene/3d/light_3d.h:172-176`). */
const LIGHT_ONLY = 1;
const SKY_ONLY = 2;

describe('directionalLightLightsSurfaces', () => {
  it('lights surfaces for a light of the default sky mode', () => {
    expect(directionalLightLightsSurfaces(DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT)).toBe(true);
    expect(directionalLightLightsSurfaces(LIGHT_ONLY)).toBe(true);
  });

  it('lights no surface for a light that lights only the sky (edge case)', () => {
    expect(directionalLightLightsSurfaces(SKY_ONLY)).toBe(false);
  });

  it('lights surfaces for an unknown sky mode, as only Sky Only is skipped (error case)', () => {
    expect(directionalLightLightsSurfaces(7)).toBe(true);
  });
});

describe('directionalLightDrawsInSky', () => {
  it('draws in the sky for a light of the default sky mode', () => {
    expect(directionalLightDrawsInSky(DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT)).toBe(true);
    expect(directionalLightDrawsInSky(SKY_ONLY)).toBe(true);
  });

  it('draws nothing in the sky for a light that lights only surfaces (edge case)', () => {
    expect(directionalLightDrawsInSky(LIGHT_ONLY)).toBe(false);
  });

  it('draws in the sky for an unknown sky mode, as only Light Only is skipped (error case)', () => {
    expect(directionalLightDrawsInSky(7)).toBe(true);
  });
});
