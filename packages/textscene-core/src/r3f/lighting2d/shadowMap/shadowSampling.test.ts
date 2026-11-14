import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { canvasShadowAtlasSize } from '../../../godot/rendering/canvasShadowAtlas';
import { SHADOW_MAP_FAR } from './shadowPolarMap';
import { updateShadowPolarTexture } from './shadowSampling';

/** The size Godot uses when the project sets none. */
const DEFAULT_ATLAS_SIZE = canvasShadowAtlasSize(undefined);

describe('updateShadowPolarTexture', () => {
  it('carries the atlas state Godot samples the map with', () => {
    // `renderer_canvas_render_rd.cpp:975-980,1930-1934`: an R32_SFLOAT row behind a nearest
    // sampler that repeats on u, so a tap at bin -1 reads the last bin.
    const texture = updateShadowPolarTexture(null, new Float32Array(DEFAULT_ATLAS_SIZE));
    expect(texture.type).toBe(THREE.FloatType);
    expect(texture.minFilter).toBe(THREE.NearestFilter);
    expect(texture.magFilter).toBe(THREE.NearestFilter);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.image.width).toBe(DEFAULT_ATLAS_SIZE);
    expect(texture.image.height).toBe(1);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(texture.generateMipmaps).toBe(false);
  });

  it('keeps an occluder distance at full float precision', () => {
    // A half float rounds 0.6 + 2^-20 to 0.6, and a fragment on the occluder line then reads as
    // shadowed where Godot lights it.
    const bins = new Float32Array(DEFAULT_ATLAS_SIZE).fill(SHADOW_MAP_FAR);
    bins[7] = Math.fround(0.6 + 2 ** -20);
    const texture = updateShadowPolarTexture(null, bins);
    const data = texture.image.data as Float32Array;
    expect(data[0]).toBe(SHADOW_MAP_FAR);
    expect(data[7]).toBe(bins[7]);
  });

  it('refills a texture of the same size in place, so the materials keep it', () => {
    const texture = updateShadowPolarTexture(null, new Float32Array(DEFAULT_ATLAS_SIZE));
    const bins = new Float32Array(DEFAULT_ATLAS_SIZE).fill(SHADOW_MAP_FAR);
    expect(updateShadowPolarTexture(texture, bins)).toBe(texture);
    expect((texture.image.data as Float32Array)[0]).toBe(SHADOW_MAP_FAR);
  });

  it('makes a fresh texture for bins of another size (edge case)', () => {
    const texture = updateShadowPolarTexture(null, new Float32Array(8));
    const next = updateShadowPolarTexture(texture, new Float32Array(DEFAULT_ATLAS_SIZE));
    expect(next).not.toBe(texture);
    expect(next.image.width).toBe(DEFAULT_ATLAS_SIZE);
  });
});
