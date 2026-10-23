import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dataArrayTexture } from '../textures/dataArrayTexture';
import { atlasWithShadowmask, combinedAtlas } from './build';

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

describe('atlasWithShadowmask', () => {
  /** An RGBA half-float atlas of `depth` layers of `width` x 1, every texel (1, 2, 3, 4). */
  const atlas = (depth: number, width = 1) =>
    dataArrayTexture(
      new Uint16Array(Array.from({ length: width * depth }, () => [1, 2, 3, 4]).flat()),
      width,
      1,
      depth
    );
  const mask = (bytes: number[]) => dataArrayTexture(new Uint8Array(bytes), bytes.length, 1, 1);
  const alphas = (texture: THREE.DataArrayTexture) =>
    Array.from(texture.image.data as Uint16Array).filter((_, i) => i % 4 === 3);
  const half = (byte: number) => THREE.DataUtils.toHalfFloat(byte / 255);

  it('writes each shadowmask byte as the half float of its value into the alpha, and leaves the light', () => {
    const merged = atlasWithShadowmask(atlas(1, 2), mask([0, 255]), 1)!;
    expect(alphas(merged)).toEqual([half(0), half(255)]);
    expect(Array.from(merged.image.data as Uint16Array).filter((_, i) => i % 4 !== 3)).toEqual([
      1, 2, 3, 1, 2, 3,
    ]);
  });

  it('writes the alpha of the first layer of each slice of directional light, four layers to the slice', () => {
    const slices = dataArrayTexture(new Uint8Array([10, 20]), 1, 1, 2);
    expect(alphas(atlasWithShadowmask(atlas(8), slices, 4)!)).toEqual([half(10), 4, 4, 4, half(20), 4, 4, 4]);
  });

  it('copies the atlas, so the loader’s texture keeps its alpha', () => {
    const source = atlas(1);
    atlasWithShadowmask(source, mask([200]), 1);
    expect(alphas(source)).toEqual([4]);
  });

  it('makes no atlas of a shadowmask of another size or slice count, which no bake saves (error case)', () => {
    expect(atlasWithShadowmask(atlas(1, 2), mask([1]), 1)).toBeNull();
    expect(atlasWithShadowmask(atlas(3), mask([1]), 4)).toBeNull();
  });
});
