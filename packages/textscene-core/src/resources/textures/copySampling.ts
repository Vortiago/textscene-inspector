/**
 * The sampler state a texture rebuilt as a `DataTexture` keeps from its source. A `DataTexture`
 * defaults to nearest filtering with no mipmaps, which a loaded image never has.
 */

import type * as THREE from 'three';
import { hasMipChain } from './godotTextureFilter';

/**
 * Writes `source`'s wrapping, filtering, mipmapping and anisotropy onto `target`, and returns it.
 * `target` holds new texels, so it asks the GPU for a chain wherever `source` samples one.
 */
export function copySampling<T extends THREE.Texture>(target: T, source: THREE.Texture): T {
  target.wrapS = source.wrapS;
  target.wrapT = source.wrapT;
  target.magFilter = source.magFilter;
  target.minFilter = source.minFilter;
  target.generateMipmaps = hasMipChain(source);
  target.anisotropy = source.anisotropy;
  return target;
}
