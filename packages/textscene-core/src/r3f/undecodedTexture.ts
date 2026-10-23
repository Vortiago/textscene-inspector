/**
 * A texture sampled without the sRGB decode that `textureProcessing.ts` tags on every
 * load, for the 2D canvas, which filters undecoded bytes (`canvas2DTextureDecode.ts`),
 * and the vendored theme icons and sprite frames. A 3D material decides per slot in
 * `resources/materials/standardmaterial3d/textureBinding.ts`, not here.
 */
import type * as THREE from 'three';
import { pinNoColorSpace } from '../resources/textures/applyTextureState';

// Re-exported for the 2D consumers. It lives beside the shared texture applier,
// which the material path also needs.
export { pinNoColorSpace };

/**
 * A `NoColorSpace` clone of `texture`, sharing its `Source`. A caller that changes its
 * sampler does so before the clone reaches `useUploadedClone`: a change after the upload
 * moves three's cache key, and three uploads the whole image again at the next draw.
 */
export function undecodedClone(texture: THREE.Texture): THREE.Texture {
  const clone = texture.clone();
  pinNoColorSpace(clone);
  clone.needsUpdate = true;
  return clone;
}
