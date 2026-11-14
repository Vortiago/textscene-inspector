/** `updateShadowPolarTexture` keeps a light's map texture while its length holds, so the materials keep it. */

import { describe, it, expect } from 'vitest';
import { canvasShadowAtlasSize } from '../../../godot/rendering/canvasShadowAtlas';
import { SHADOW_MAP_FAR } from './shadowPolarMap';
import { updateShadowPolarTexture } from './shadowSampling';

/** The size Godot uses when the project sets none. */
const DEFAULT_ATLAS_SIZE = canvasShadowAtlasSize(undefined);

describe('updateShadowPolarTexture', () => {
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
