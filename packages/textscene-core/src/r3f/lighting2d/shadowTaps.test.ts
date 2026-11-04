/**
 * The taps a shadowed 2D light reads its map with, against renderer_rd's `light_shadow_compute`
 * (`canvas.glsl:507-535`) and `texture_shadow` (`:392-399`). The goldens pin the pixels.
 */

import { describe, it, expect } from 'vitest';
import { SHADOW_TAPS, shadowPixelSize } from './shadowTaps';
import { SHADOW_MAP_BINS } from './shadowPolarMap';

describe('shadowPixelSize', () => {
  it('is one atlas texel widened by shadow_filter_smooth', () => {
    expect(shadowPixelSize(0)).toBe(1 / 2048);
    expect(shadowPixelSize(8)).toBe(9 / 2048);
    // Smooth 5 is the dungeon lights' penumbra.
    expect(shadowPixelSize(5) * SHADOW_MAP_BINS).toBe(6);
  });
});

describe('SHADOW_TAPS', () => {
  it('takes one nearest bin under NONE, floored by the canvas-wide bin and not the smoothed one', () => {
    // `canvas.glsl:508`: `floor(shadow_uv.xy / canvas_data.shadow_pixel_size)`, so a fragment lit on
    // the exact ray reads as shadowed when its bin lies behind the occluder.
    expect(SHADOW_TAPS).toContain('return step(shadowTexel(floor(u * 2048.0)), depth);');
  });

  it('mixes the steps of bins i−1 and i by the fraction past bin i in each PCF tap', () => {
    // `textureGather(...).zw` at the floored texel corner is (bin i, bin i−1).
    expect(SHADOW_TAPS).toContain(
      'mix(step(shadowTexel(texel - 1.0), depth), step(shadowTexel(texel), depth), scaled - texel)'
    );
  });

  it('spreads PCF13 over thirteen taps and PCF5 over five, each one smoothed bin apart', () => {
    expect(SHADOW_TAPS).toContain(
      '#if SHADOW_FILTER == 2\n  const int reach = 6;\n#else\n  const int reach = 2;'
    );
    expect(SHADOW_TAPS).toContain(
      'for (int tap = -reach; tap <= reach; tap++) shadow += textureShadow(u + uShadowPixelSize * float(tap), depth);\n  return shadow / float(2 * reach + 1);'
    );
  });
});
