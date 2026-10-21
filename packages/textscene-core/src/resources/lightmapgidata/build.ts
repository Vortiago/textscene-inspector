/**
 * The atlas a LightmapGIData draws from: its one lightmap texture, or the layers of all of them in
 * order (`lightmap_gi.cpp:102-129`). It value-imports `three`, so `index.ts` never imports it.
 */

import type * as THREE from 'three';
import { dataArrayTexture } from '../textures/dataArrayTexture';

/**
 * A lone texture is the atlas itself. Several are stacked into a new one, which needs one size
 * for every layer (`image_texture.cpp:300-307`). Null for none, or for textures of different sizes.
 */
export function combinedLightmapAtlas(
  textures: readonly THREE.DataArrayTexture[]
): THREE.DataArrayTexture | null {
  if (textures.length <= 1) return textures[0] ?? null;
  const { width, height } = textures[0]!.image;
  if (textures.some(({ image }) => image.width !== width || image.height !== height)) return null;
  const depth = textures.reduce((sum, { image }) => sum + image.depth, 0);
  const texels = new Uint16Array(width * height * depth * 4);
  let offset = 0;
  for (const { image } of textures) {
    texels.set(image.data as Uint16Array, offset);
    offset += image.data!.length;
  }
  return dataArrayTexture(texels, width, height, depth);
}
