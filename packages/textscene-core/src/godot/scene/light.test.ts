import { describe, expect, it } from 'vitest';
import {
  AREA_LIGHT_3D_DEFAULTS,
  BakeMode,
  DIRECTIONAL_LIGHT_3D_DEFAULTS,
  LIGHT_3D_BAKE_MODE_NAMES,
  LIGHT_3D_DEFAULTS,
  DIRECTIONAL_LIGHT_3D_AABB,
  omniLight3DAabb,
  spotLight3DAabb,
  OMNI_LIGHT_3D_SHADOW_MODE_NAMES,
  SPOT_LIGHT_3D_DEFAULTS,
} from './light';
import { DirectionalShadowMode } from '../rendering/lights/directionalShadow';
import { DirectionalLightSkyMode } from '../rendering/lights/directionalLightSkyMode';

describe('LIGHT_3D_DEFAULTS', () => {
  it('holds what Light3D() sets for every light type', () => {
    // `light_3d.cpp:468-491` and `light_3d.h:79-85`.
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
      bakeMode: BakeMode.DYNAMIC,
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

describe('Light3D::get_aabb (light_3d.cpp:157-179)', () => {
  it('is the cube of side 2 for a directional light', () => {
    expect(DIRECTIONAL_LIGHT_3D_AABB).toEqual({
      position: { x: -1, y: -1, z: -1 },
      size: { x: 2, y: 2, z: 2 },
    });
  });

  it('is the cube of side 2 * range for an omni light', () => {
    expect(omniLight3DAabb(5)).toEqual({ position: { x: -5, y: -5, z: -5 }, size: { x: 10, y: 10, z: 10 } });
  });

  it('is the box of the cone for a spot light, from its apex to its range along -Z', () => {
    const { position, size } = spotLight3DAabb(10, 30);
    // sin(30 degrees) * 10 = 5
    expect(position.x).toBeCloseTo(-5, 12);
    expect(size.x).toBeCloseTo(10, 12);
    expect(position.z).toBe(-10);
    expect(size.z).toBe(10);
  });

  // Measured in Godot 4.6.3 with `Light3D.get_aabb`.
  it.each([
    [5, 45, 3.535534],
    [3, 1, 0.052357],
  ])('is the cone box for range %s and angle %s, half as wide as %s', (range, angle, half) => {
    const { position, size } = spotLight3DAabb(range, angle);
    expect(position.x).toBeCloseTo(-half, 6);
    expect(size.x).toBeCloseTo(2 * half, 6);
    expect(position.z).toBe(-range);
  });

  it('is empty for a range of 0', () => {
    expect(omniLight3DAabb(0).size).toEqual({ x: 0, y: 0, z: 0 });
    expect(spotLight3DAabb(0, 45).size).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('is the omni box for a spot angle past 90 degrees', () => {
    expect(spotLight3DAabb(4, 100)).toEqual(omniLight3DAabb(4));
  });

  it('stays a cone at exactly 90 degrees', () => {
    expect(spotLight3DAabb(4, 90).size.z).toBe(4);
  });
});
