/**
 * Whether a texture's mip chain renormalises each level's normals, as the import of a normal map
 * builds it (`core/io/image.cpp:1981-2015`). A texture cut from it builds its own chain the same way.
 */

import type * as THREE from 'three';

const RENORMALIZED_CHAIN = 'godotRenormalizedChain';

/** Records on `texture` that its chain renormalises. */
export function recordRenormalizedChain<T extends THREE.Texture>(texture: T): T {
  texture.userData[RENORMALIZED_CHAIN] = true;
  return texture;
}

export function hasRenormalizedChain(texture: THREE.Texture): boolean {
  return texture.userData[RENORMALIZED_CHAIN] === true;
}
