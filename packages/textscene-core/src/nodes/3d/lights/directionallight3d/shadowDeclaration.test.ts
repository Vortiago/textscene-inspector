import { describe, it, expect } from 'vitest';
import { directionalShadowDeclaration } from './shadowDeclaration';
import { directionalShadowBias } from '../shared/shadowBias';
import { DirectionalShadowMode } from '../../../../godot/directionalShadow';
import { DirectionalLightSkyMode } from '../../../../godot/directionalLightSkyMode';

describe('directionalShadowDeclaration', () => {
  it('declares the authored shadow properties', () => {
    const declaration = directionalShadowDeclaration({
      shadow_enabled: true,
      shadow_bias: 0.5,
      shadow_blur: 2,
      shadow_normal_bias: 1.5,
      directional_shadow_mode: DirectionalShadowMode.PARALLEL_2_SPLITS,
      directional_shadow_split_1: 0.3,
      directional_shadow_split_2: 0.4,
      directional_shadow_split_3: 0.9,
      directional_shadow_blend_splits: true,
      directional_shadow_max_distance: 80,
      directional_shadow_pancake_size: 5,
      directional_shadow_fade_start: 0.5,
    });
    expect(declaration).toEqual({
      maxDistance: 80,
      pancakeSize: 5,
      fadeStart: 0.5,
      depthBias: directionalShadowBias({ shadow_bias: 0.5, shadow_blur: 2 }),
      normalBias: 1.5,
      filterRadius: 4,
      softShadowAngle: 0,
      drawsSoftShadow: false,
      splitCount: 2,
      splitOffsets: [0.3, 0.4, 0.9],
      blendSplits: true,
      sharesAtlas: true,
    });
  });

  it('declares Godot’s class default for every property left out (edge case)', () => {
    // `light_3d.cpp:483-490` and `:600-608`.
    expect(directionalShadowDeclaration({ shadow_enabled: true })).toEqual({
      maxDistance: 100,
      pancakeSize: 20,
      fadeStart: 0.8,
      depthBias: directionalShadowBias({}),
      normalBias: 2,
      filterRadius: 2,
      softShadowAngle: 0,
      drawsSoftShadow: false,
      splitCount: 4,
      splitOffsets: [0.1, 0.2, 0.5],
      blendSplits: false,
      sharesAtlas: true,
    });
  });

  it('declares a kernel of zero radius for a light with no blur (edge case)', () => {
    // `light_storage.cpp:697-703`: 0 * 2. Every PCF tap then reads the centre texel.
    expect(directionalShadowDeclaration({ shadow_enabled: true, shadow_blur: 0 }).filterRadius).toBe(0);
  });

  it('declares the blocker search of a light with an angular distance', () => {
    // `light_storage.cpp:676-703`: tan(45°) = 1, and the blur alone spreads the search.
    const declaration = directionalShadowDeclaration({
      shadow_enabled: true,
      shadow_blur: 1.5,
      light_angular_distance: 45,
    });
    expect(declaration.softShadowAngle).toBeCloseTo(1, 12);
    expect(declaration.filterRadius).toBe(1.5);
    expect(declaration.drawsSoftShadow).toBe(true);
  });

  it('declares no blocker search for an angular distance without a blur (edge case)', () => {
    const declaration = directionalShadowDeclaration({
      shadow_enabled: true,
      shadow_blur: 0,
      light_angular_distance: 2,
    });
    expect(declaration.drawsSoftShadow).toBe(false);
    expect(declaration.softShadowAngle).toBeGreaterThan(0);
  });

  it('declares no share of the atlas for a light that lights only the sky (edge case)', () => {
    const declaration = directionalShadowDeclaration({
      shadow_enabled: true,
      sky_mode: DirectionalLightSkyMode.SKY_ONLY,
    });
    expect(declaration.sharesAtlas).toBe(false);
  });

  it('declares no split, but a share, for a mode Godot sets up no split for (error case)', () => {
    // `renderer_scene_cull.cpp:2155-2166` has no default case, and `:3271` ignores the mode.
    const declaration = directionalShadowDeclaration({ shadow_enabled: true, directional_shadow_mode: 3 });
    expect(declaration.splitCount).toBe(0);
    expect(declaration.sharesAtlas).toBe(true);
  });
});
