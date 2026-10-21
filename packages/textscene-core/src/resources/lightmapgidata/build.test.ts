import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { dataArrayTexture } from '../textures/dataArrayTexture';
import { combinedLightmapAtlas } from './build';

/** A 1 x 1 texture of `depth` layers, each texel's red the layer's `first + index`. */
function layers(first: number, depth: number, width = 1): THREE.DataArrayTexture {
  const texels = new Uint16Array(width * depth * 4);
  for (let layer = 0; layer < depth; layer++)
    texels.fill(first + layer, layer * width * 4, (layer + 1) * width * 4);
  return dataArrayTexture(texels, width, 1, depth);
}

describe('combinedLightmapAtlas', () => {
  it('uses a lone texture as the atlas', () => {
    const only = layers(0, 2);
    expect(combinedLightmapAtlas([only])).toBe(only);
  });

  it('stacks the layers of several textures in order, as set_lightmap_textures does', () => {
    const atlas = combinedLightmapAtlas([layers(10, 2), layers(20, 1)])!;
    expect(atlas.image.depth).toBe(3);
    expect(Array.from(atlas.image.data as Uint16Array).filter((_, i) => i % 4 === 0)).toEqual([10, 11, 20]);
  });

  it('makes no atlas of textures of different sizes, which create_from_images refuses (error case)', () => {
    expect(combinedLightmapAtlas([layers(0, 1), layers(0, 1, 2)])).toBeNull();
  });

  it('makes no atlas of no textures (edge case)', () => {
    expect(combinedLightmapAtlas([])).toBeNull();
  });
});
