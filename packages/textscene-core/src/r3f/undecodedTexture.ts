/**
 * A texture sampled without the sRGB decode that `textureProcessing.ts` tags on every
 * load, for the 2D canvas, which filters undecoded bytes (`canvas2DTextureDecode.ts`),
 * and the vendored theme icons and sprite frames. A 3D material decides per slot in
 * `resources/materials/standardmaterial3d/textureBinding.ts`, not here.
 */
import { useMemo } from 'react';
import type * as THREE from 'three';
import { pinNoColorSpace } from '../resources/textures/applyTextureState';
import { useUploadedClone } from './tiledUpload/useTiledUpload';

// Re-exported for the 2D consumers. It lives beside the shared texture applier,
// which the material path also needs.
export { pinNoColorSpace };

/**
 * An undecoded (`NoColorSpace`) view of a shared texture: a clone, since `useResource`
 * hands every consumer the same cached texture and an in-place retag would flip an
 * albedo elsewhere. Memoised on the input. Inside a canvas, a large clone uploads in
 * bands and the previous one draws meanwhile. Each clone is disposed once it no longer
 * draws. `null` while there is nothing to show.
 */
export function useUndecodedTexture(
  texture: THREE.Texture | null | undefined
): THREE.Texture | null {
  const cloned = useMemo(() => (texture ? undecodedClone(texture) : null), [texture]);
  return useUploadedClone(cloned);
}

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
