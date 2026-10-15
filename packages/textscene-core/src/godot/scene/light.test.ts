import { describe, expect, it } from 'vitest';
import {
  AREA_LIGHT_3D_DEFAULTS,
  DIRECTIONAL_LIGHT_3D_DEFAULTS,
  LIGHT_3D_DEFAULTS,
  SPOT_LIGHT_3D_DEFAULTS,
} from './light';
import { DirectionalShadowMode } from '../rendering/lights/directionalShadow';
import { DirectionalLightSkyMode } from '../rendering/lights/directionalLightSkyMode';

describe('LIGHT_3D_DEFAULTS', () => {
  it('holds what Light3D() sets for every light type', () => {
    expect(LIGHT_3D_DEFAULTS).toMatchObject({
      specular: 0.5,
      size: 0,
      range: 5,
      shadowBias: 0.1,
      shadowNormalBias: 1,
      shadowBlur: 1,
      distanceFade: { begin: 40, shadow: 50, length: 10 },
    });
  });
});

describe('DIRECTIONAL_LIGHT_3D_DEFAULTS', () => {
  it('overrides the specular and the shadow normal bias that DirectionalLight3D() sets', () => {
    expect(DIRECTIONAL_LIGHT_3D_DEFAULTS.specular).toBe(1);
    expect(DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowNormalBias).toBe(2);
  });

  it('starts with four splits that light both the scene and the sky', () => {
    expect(DIRECTIONAL_LIGHT_3D_DEFAULTS.shadowMode).toBe(DirectionalShadowMode.PARALLEL_4_SPLITS);
    expect(DIRECTIONAL_LIGHT_3D_DEFAULTS.skyMode).toBe(DirectionalLightSkyMode.LIGHT_AND_SKY);
  });

  it('keeps the Light3D size, which light_angular_distance reads', () => {
    expect(DIRECTIONAL_LIGHT_3D_DEFAULTS.size).toBe(0);
  });
});

describe('SPOT_LIGHT_3D_DEFAULTS', () => {
  it('lowers the shadow bias and keeps the rest of Light3D', () => {
    expect(SPOT_LIGHT_3D_DEFAULTS.shadowBias).toBe(0.03);
    expect(SPOT_LIGHT_3D_DEFAULTS.spotAngle).toBe(45);
  });
});

describe('AREA_LIGHT_3D_DEFAULTS', () => {
  it('sets its own size and specular over Light3D', () => {
    expect(AREA_LIGHT_3D_DEFAULTS.size).toBe(0.5);
    expect(AREA_LIGHT_3D_DEFAULTS.specular).toBe(1);
    expect(AREA_LIGHT_3D_DEFAULTS.areaSize).toEqual({ x: 1, y: 1 });
  });
});
