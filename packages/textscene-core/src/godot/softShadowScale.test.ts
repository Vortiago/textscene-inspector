import { describe, expect, it } from 'vitest';
import { SHADOW_BLUR_DEFAULT, SOFT_LOW_QUALITY_RADIUS, softShadowScale } from './softShadowScale';

describe('softShadowScale', () => {
  it('is the default blur times the Soft Low quality radius', () => {
    // `light_3d.cpp:489` and `renderer_scene_render_rd.cpp:1207`: 1 * 2.
    expect(softShadowScale(undefined)).toBe(SHADOW_BLUR_DEFAULT * SOFT_LOW_QUALITY_RADIUS);
    expect(softShadowScale(undefined)).toBe(2);
  });

  it('scales linearly with shadow_blur', () => {
    expect(softShadowScale(2.5)).toBe(5);
  });

  it('is zero for a light with no blur (edge case)', () => {
    expect(softShadowScale(0)).toBe(0);
  });

  it('passes a non-finite blur through, as Godot multiplies it unchecked (error case)', () => {
    expect(softShadowScale(Number.NaN)).toBeNaN();
  });
});
