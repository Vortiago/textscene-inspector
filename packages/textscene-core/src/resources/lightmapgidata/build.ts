/**
 * The atlas a LightmapGIData draws from: its one lightmap or shadowmask texture, or the layers of
 * all of them in order (`lightmap_gi.cpp:102-129`, `:135-165`). It value-imports `three`, so
 * `index.ts` never imports it.
 */

import * as THREE from 'three';
import { emptyLike } from '../../utils/emptyLike';
import { dataArrayTexture } from '../textures/dataArrayTexture';

/**
 * A lone texture is the atlas itself. Several are stacked into a new one, which needs one size
 * and one texel type for every layer (`image_texture.cpp:300-307`): half floats for a lightmap,
 * one red byte for a shadowmask. Null for none, or for textures of different sizes.
 */
export function combinedAtlas(textures: readonly THREE.DataArrayTexture[]): THREE.DataArrayTexture | null {
  if (textures.length <= 1) return textures[0] ?? null;
  const { width, height } = textures[0]!.image;
  if (textures.some(({ image }) => image.width !== width || image.height !== height)) return null;
  const depth = textures.reduce((sum, { image }) => sum + image.depth, 0);
  const length = textures.reduce((sum, { image }) => sum + image.data!.length, 0);
  const texels = emptyLike(textures[0]!.image.data as Uint16Array | Uint8Array, length);
  let offset = 0;
  for (const { image } of textures) {
    texels.set(image.data as Uint16Array | Uint8Array, offset);
    offset += image.data!.length;
  }
  return dataArrayTexture(texels, width, height, depth);
}

/** Each shadowmask byte as the half float of its value over 255, so a sample reads it as the byte does. */
const MASK_HALF_FLOATS = Uint16Array.from({ length: 256 }, (_, byte) =>
  THREE.DataUtils.toHalfFloat(byte / 255)
);

/**
 * A copy of the lightmap atlas that holds the shadowmask in the alpha of the first layer of each
 * slice, so the program reads both through one sampler: a program has 16 sampler units to share.
 * A slice is `layersPerSlice` layers, four for directional light. Null when the shadowmask is not one
 * byte layer for each slice at the atlas's size, which no bake saves.
 */
export function atlasWithShadowmask(
  atlas: THREE.DataArrayTexture,
  shadowmask: THREE.DataArrayTexture,
  layersPerSlice: number
): THREE.DataArrayTexture | null {
  const { width, height, depth } = atlas.image;
  const mask = shadowmask.image;
  const light = atlas.image.data;
  if (!(light instanceof Uint16Array) || !(mask.data instanceof Uint8Array)) return null;
  if (mask.width !== width || mask.height !== height || mask.depth * layersPerSlice !== depth) return null;
  const texels = light.slice();
  const sliceTexels = width * height;
  for (let slice = 0; slice < mask.depth; slice++) {
    const lightFirst = slice * layersPerSlice * sliceTexels;
    const maskFirst = slice * sliceTexels;
    for (let texel = 0; texel < sliceTexels; texel++) {
      texels[(lightFirst + texel) * 4 + 3] = MASK_HALF_FLOATS[mask.data[maskFirst + texel]!]!;
    }
  }
  return dataArrayTexture(texels, width, height, depth);
}
