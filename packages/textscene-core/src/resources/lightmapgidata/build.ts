/**
 * The atlas a LightmapGIData draws from: its one lightmap or shadowmask texture, or the layers of
 * all of them in order (`lightmap_gi.cpp:102-129`, `:135-165`). It value-imports `three`, so
 * `index.ts` never imports it.
 */

import type * as THREE from 'three';
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
  const texels =
    textures[0]!.image.data instanceof Uint16Array ? new Uint16Array(length) : new Uint8Array(length);
  let offset = 0;
  for (const { image } of textures) {
    texels.set(image.data as Uint16Array | Uint8Array, offset);
    offset += image.data!.length;
  }
  return dataArrayTexture(texels, width, height, depth);
}
