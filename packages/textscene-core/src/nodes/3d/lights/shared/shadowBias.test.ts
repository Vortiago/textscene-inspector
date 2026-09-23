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
  it('converts Godot’s unscaled world-space radial offset at the far plane', () => {
    // `light_storage.cpp:973` sends the bias unscaled, subtracted from a world
    // distance (`scene_forward_lights_inc.glsl:594`). three's cube depth is projective
    // (`shadowmap_pars_fragment.glsl.js:292`), so at z = far d(dp)/dz is near / (far * (far - near)):
    // the default 0.1 (`light_3d.cpp:490`), near 0.5, range 5 gives 0.1 * 0.5 / (5 * 4.5) = 1/450.
    expect(omniShadowBias(undefined, 0.5, 5)).toBeCloseTo(-1 / 450, 12);
  });

  it('shrinks as the light’s range grows, because the far plane moves out', () => {
    // 0.2 * 0.5 / (10 * 9.5) = 0.1 / 95.
    expect(omniShadowBias(0.2, 0.5, 10)).toBeCloseTo(-0.1 / 95, 12);
  });

  it('is zero for a light with no depth range to bias within', () => {
    expect(omniShadowBias(0.1, 0.5, 0.5)).toBe(0);
  });
});

describe('spotShadowBias', () => {
  it('divides Godot’s pre-divide clip offset by the far plane', () => {
    // `scene_forward_lights_inc.glsl:786` adds before `splane /= splane.w`, buying
    // `shadow_bias / w`. SpotLight3D's default 0.03 (`light_3d.cpp:681`), scaled by
    // soft_shadow_scale (`light_storage.cpp:1024`), is 0.03 / 100 * 2 / 5 = 0.00012.
    expect(spotShadowBias(undefined, undefined, 5)).toBeCloseTo(-0.00012, 12);
  });

  it('gives the same depth for twice the bias over twice the range', () => {
    // 0.06 / 100 * 2 / 10 = 0.00012: the offset is a ratio, not a distance.
    expect(spotShadowBias(0.06, undefined, 10)).toBeCloseTo(-0.00012, 12);
  });

  it('carries shadow_blur, which Godot folds into the spot bias alone', () => {
    // 0.03 / 100 * (0.5 * 2) / 5 = 0.00006.
    expect(spotShadowBias(0.03, 0.5, 5)).toBeCloseTo(-0.00006, 12);
  });

  it('is zero for a light with no range to divide by', () => {
    expect(spotShadowBias(0.03, undefined, 0)).toBe(0);
  });
});
