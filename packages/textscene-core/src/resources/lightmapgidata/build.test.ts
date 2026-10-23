import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dataArrayTexture } from '../textures/dataArrayTexture';
import { combinedAtlas } from './build';

/** A `width` x 1 texture of `depth` layers, each texel's red the layer's `first + index`. */
function layers(
  first: number,
  depth: number,
  width = 1,
  Texels: Uint16ArrayConstructor | Uint8ArrayConstructor = Uint16Array
): THREE.DataArrayTexture {
  const channels = Texels === Uint16Array ? 4 : 1;
  const texels = new Texels(width * depth * channels);
  for (let layer = 0; layer < depth; layer++)
    texels.fill(first + layer, layer * width * channels, (layer + 1) * width * channels);
  return dataArrayTexture(texels, width, 1, depth);
}

describe('combinedAtlas', () => {
  it('uses a lone texture as the atlas', () => {
    const only = layers(0, 2);
    expect(combinedAtlas([only])).toBe(only);
  });

  it('stacks the layers of several textures in order, as set_lightmap_textures does', () => {
    const atlas = combinedAtlas([layers(10, 2), layers(20, 1)])!;
    expect(atlas.image.depth).toBe(3);
    expect(Array.from(atlas.image.data as Uint16Array).filter((_, i) => i % 4 === 0)).toEqual([10, 11, 20]);
  });

  it('stacks the layers of several shadowmask textures, which hold bytes', () => {
    const atlas = combinedAtlas([layers(10, 2, 1, Uint8Array), layers(20, 1, 1, Uint8Array)])!;
    expect(atlas.type).toBe(THREE.UnsignedByteType);
    expect(Array.from(atlas.image.data as Uint8Array)).toEqual([10, 11, 20]);
  });

  it('makes no atlas of textures of different sizes, which create_from_images refuses (error case)', () => {
    expect(combinedAtlas([layers(0, 1), layers(0, 1, 2)])).toBeNull();
  });

  it('makes no atlas of no textures (edge case)', () => {
    expect(combinedAtlas([])).toBeNull();
  });
});
