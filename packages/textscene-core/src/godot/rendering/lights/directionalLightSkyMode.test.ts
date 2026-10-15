import { describe, it, expect } from 'vitest';
import {
  DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT,
  DirectionalLightSkyMode,
  directionalLightDrawsInSky,
  directionalLightLightsSurfaces,
} from './directionalLightSkyMode.js';

describe('directionalLightLightsSurfaces', () => {
  it('lights surfaces for a light of the default sky mode', () => {
    expect(directionalLightLightsSurfaces(DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT)).toBe(true);
    expect(directionalLightLightsSurfaces(DirectionalLightSkyMode.LIGHT_ONLY)).toBe(true);
  });

  it('lights no surface for a light that lights only the sky (edge case)', () => {
    expect(directionalLightLightsSurfaces(DirectionalLightSkyMode.SKY_ONLY)).toBe(false);
  });

  it('lights surfaces for an unknown sky mode, as only Sky Only is skipped (error case)', () => {
    expect(directionalLightLightsSurfaces(7)).toBe(true);
  });
});

describe('directionalLightDrawsInSky', () => {
  it('draws in the sky for a light of the default sky mode', () => {
    expect(directionalLightDrawsInSky(DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT)).toBe(true);
    expect(directionalLightDrawsInSky(DirectionalLightSkyMode.SKY_ONLY)).toBe(true);
  });

  it('draws nothing in the sky for a light that lights only surfaces (edge case)', () => {
    expect(directionalLightDrawsInSky(DirectionalLightSkyMode.LIGHT_ONLY)).toBe(false);
  });

  it('draws in the sky for an unknown sky mode, as only Light Only is skipped (error case)', () => {
    expect(directionalLightDrawsInSky(7)).toBe(true);
  });
});
