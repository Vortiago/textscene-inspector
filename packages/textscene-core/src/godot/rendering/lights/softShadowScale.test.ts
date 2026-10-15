import { describe, expect, it } from 'vitest';
import { softShadowScale } from './softShadowScale';

describe('softShadowScale', () => {
  it('is the default blur times the Soft Low quality radius', () => {
    // `light_3d.cpp:489` and `renderer_scene_render_rd.cpp:1207`: 1 * 2.
    expect(softShadowScale(undefined, 0)).toBe(2);
  });

  it('scales linearly with shadow_blur', () => {
    expect(softShadowScale(2.5, 0)).toBe(5);
  });

  it('is zero for a light with no blur (edge case)', () => {
    expect(softShadowScale(0, 0)).toBe(0);
  });

  it('is the blur alone for a light with an angular distance, which searches for blockers', () => {
    // `light_storage.cpp:697-703`: the quality radius is for PCF only.
    expect(softShadowScale(2.5, 1.5)).toBe(2.5);
  });

  it('passes a non-finite blur through, as Godot multiplies it unchecked (error case)', () => {
    expect(softShadowScale(Number.NaN, 0)).toBeNaN();
  });
});
