/**
 * The sampler state a texture rebuilt as a `DataTexture` keeps from its source. A `DataTexture`
 * defaults to nearest filtering with no mipmaps, which a loaded image never has.
 */

import type * as THREE from 'three';

/** Writes `source`'s wrapping, filtering, mipmapping and anisotropy onto `target`, and returns it. */
export function copySampling<T extends THREE.Texture>(target: T, source: THREE.Texture): T {
  target.wrapS = source.wrapS;
  target.wrapT = source.wrapT;
  target.magFilter = source.magFilter;
  target.minFilter = source.minFilter;
  target.generateMipmaps = source.generateMipmaps;
  target.anisotropy = source.anisotropy;
  return target;
}
