/**
 * The taps a shadowed 2D light reads its map with, against renderer_rd's `light_shadow_compute`
 * (`canvas.glsl:507-535`) and `texture_shadow` (`:392-399`). The goldens pin the pixels.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SHADOW_BINS, SHADOW_TAPS, shadowMapUniforms } from './shadowTaps';

describe('SHADOW_BINS', () => {
  it('is the width of the map it samples, so the atlas size has one source', () => {
    expect(SHADOW_BINS).toContain('float shadowBins() { return uShadowBins; }');
    expect(SHADOW_BINS).not.toContain('2048');
  });
});

describe('shadowMapUniforms', () => {
  it('holds the map and its width', () => {
    const map = new THREE.DataTexture(new Float32Array(512), 512, 1, THREE.RedFormat, THREE.FloatType);
    const uniforms = shadowMapUniforms(map);
    expect(uniforms.uShadowMap.value).toBe(map);
    expect(uniforms.uShadowBins.value).toBe(512);
  });

  it('names the expected map when the texture has no image', () => {
    expect(() => shadowMapUniforms(new THREE.Texture())).toThrow('expected a shadow map with an image');
  });
});

describe('SHADOW_TAPS', () => {
  it('takes one nearest bin under NONE, floored by the canvas-wide bin and not the smoothed one', () => {
    // `canvas.glsl:508`: `floor(shadow_uv.xy / canvas_data.shadow_pixel_size)`, so a fragment lit on
    // the exact ray reads as shadowed when its bin lies behind the occluder.
    expect(SHADOW_TAPS).toContain('return step(shadowTexel(floor(u * shadowBins())), depth);');
  });

  it('has no atlas size baked in', () => {
    expect(SHADOW_TAPS).not.toContain('2048');
  });

  it('steps a PCF tap by `(1 + shadow_filter_smooth) / shadow_texture_size` (`:629`)', () => {
    expect(SHADOW_TAPS).toContain('float tapStep = (1.0 + uShadowSmooth) / shadowBins();');
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
      'for (int tap = -reach; tap <= reach; tap++) shadow += textureShadow(u + tapStep * float(tap), depth);\n  return shadow / float(2 * reach + 1);'
    );
  });
});
