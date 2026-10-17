import { describe, expect, it } from 'vitest';
import {
  AREA_LIGHT_3D_DEFAULTS,
  DIRECTIONAL_LIGHT_3D_DEFAULTS,
  LIGHT_3D_BAKE_MODE_NAMES,
  LIGHT_3D_DEFAULTS,
  OMNI_LIGHT_3D_SHADOW_MODE_NAMES,
  SPOT_LIGHT_3D_DEFAULTS,
} from './light';
import { DirectionalShadowMode } from '../rendering/lights/directionalShadow';
import { DirectionalLightSkyMode } from '../rendering/lights/directionalLightSkyMode';

describe('LIGHT_3D_DEFAULTS', () => {
  it('holds what Light3D() sets for every light type', () => {
    // `light_3d.cpp:468-491` and `light_3d.h:79-81`.
    expect(LIGHT_3D_DEFAULTS).toEqual({
      color: 'Color(1, 1, 1, 1)',
      energy: 1,
      volumetricFogEnergy: 1,
      specular: 0.5,
      range: 5,
      size: 0,
      attenuation: 1,
      spotAngle: 45,
      spotAngleAttenuation: 1,
      shadowSplitOffsets: [0.1, 0.2, 0.5],
      shadowPancakeSize: 20,
      shadowOpacity: 1,
      shadowBlur: 1,
      shadowBias: 0.1,
      shadowNormalBias: 1,
      distanceFade: { begin: 40, shadow: 50, length: 10 },
    });
  });
});

describe('DIRECTIONAL_LIGHT_3D_DEFAULTS', () => {
  it('is Light3D with what DirectionalLight3D() sets', () => {
    // `light_3d.cpp:600-608`.
    expect(DIRECTIONAL_LIGHT_3D_DEFAULTS).toEqual({
      ...LIGHT_3D_DEFAULTS,
      shadowMaxDistance: 100,
      shadowFadeStart: 0.8,
      shadowNormalBias: 2,
      specular: 1,
      shadowMode: DirectionalShadowMode.PARALLEL_4_SPLITS,
      blendSplits: false,
      skyMode: DirectionalLightSkyMode.LIGHT_AND_SKY,
    });
  });
});

describe('SPOT_LIGHT_3D_DEFAULTS', () => {
  it('is Light3D with the lower shadow bias SpotLight3D() sets', () => {
    // `light_3d.cpp:681`.
    expect(SPOT_LIGHT_3D_DEFAULTS).toEqual({ ...LIGHT_3D_DEFAULTS, shadowBias: 0.03 });
  });
});

describe('AREA_LIGHT_3D_DEFAULTS', () => {
  it('is Light3D with what AreaLight3D() sets', () => {
    // 4.7.2 `light_3d.cpp:746-750`.
    expect(AREA_LIGHT_3D_DEFAULTS).toEqual({
      ...LIGHT_3D_DEFAULTS,
      shadowBias: 0.1,
      size: 0.5,
      specular: 1,
      areaSize: { x: 1, y: 1 },
      areaNormalizeEnergy: true,
    });
  });
});

describe('Light3D enum label tables', () => {
  it('names the bake modes without their BAKE_ prefix (light_3d.h:64-68)', () => {
    expect(LIGHT_3D_BAKE_MODE_NAMES).toEqual({ 0: 'DISABLED', 1: 'STATIC', 2: 'DYNAMIC' });
  });

  it('names the omni shadow modes without their SHADOW_ prefix (light_3d.h:208-211)', () => {
    expect(OMNI_LIGHT_3D_SHADOW_MODE_NAMES).toEqual({ 0: 'DUAL_PARABOLOID', 1: 'CUBE' });
  });
});
