import { describe, expect, it } from 'vitest';
import { directionalShadowBias, omniShadowBias, spotShadowBias } from './shadowBias';

describe('directionalShadowBias', () => {
  it('is Godot’s own depth-range-free fraction, negated for three’s compare', () => {
    // `light_storage.cpp:722-723` sends `shadow_bias / 100 * bias_scale`, and
    // `renderer_scene_cull.cpp:2348` and `scene_forward_clustered.glsl:2304` cancel
    // the range. The default 0.1 (`light_3d.cpp:490`) at PCF radius 2 (`rendering_server.cpp:3706`,
    // `renderer_scene_render_rd.cpp:1204-1207`) is 0.1 / 100 * 2 = 0.002.
    expect(directionalShadowBias(undefined, undefined)).toBeCloseTo(-0.002, 12);
  });

  it('scales linearly with shadow_bias', () => {
    // 0.5 / 100 * 2 = 0.01.
    expect(directionalShadowBias(0.5, undefined)).toBeCloseTo(-0.01, 12);
  });

  it('takes shadow_blur into the same product Godot does', () => {
    // `light_storage.cpp:697` seeds soft_shadow_scale from SHADOW_BLUR before
    // the quality radius multiplies it: 0.1 / 100 * (0.5 * 2) = 0.001.
    expect(directionalShadowBias(0.1, 0.5)).toBeCloseTo(-0.001, 12);
  });

  it('is zero when the author zeroes the bias', () => {
    expect(directionalShadowBias(0, undefined)).toBe(-0);
  });
});

describe('omniShadowBias', () => {
  it('keeps Godot’s default in world units, for the patched omni lookup', () => {
    // `light_storage.cpp:973` sends the default 0.1 (`light_3d.cpp:490`) unscaled.
    expect(omniShadowBias(undefined)).toBe(0.1);
  });

  it('keeps an authored bias as it is', () => {
    expect(omniShadowBias(0.25)).toBe(0.25);
  });

  it('keeps a zero bias (edge case)', () => {
    expect(omniShadowBias(0)).toBe(0);
  });

  it('passes a non-finite bias through (error case)', () => {
    expect(omniShadowBias(Number.NaN)).toBeNaN();
  });
});

describe('spotShadowBias', () => {
  it('scales SpotLight3D’s default by soft_shadow_scale, in Godot’s clip depth', () => {
    // 0.03 (`light_3d.cpp:681`) / 100 * 2 (`light_storage.cpp:1024`).
    expect(spotShadowBias(undefined, undefined)).toBeCloseTo(0.0006, 12);
  });

  it('carries shadow_blur, which Godot folds into the spot bias alone', () => {
    // 0.03 / 100 * (0.5 * 2).
    expect(spotShadowBias(0.03, 0.5)).toBeCloseTo(0.0003, 12);
  });

  it('is zero for a light with no blur (edge case)', () => {
    expect(spotShadowBias(0.03, 0)).toBe(0);
  });

  it('passes a non-finite bias through (error case)', () => {
    expect(spotShadowBias(Number.NaN, undefined)).toBeNaN();
  });
});
