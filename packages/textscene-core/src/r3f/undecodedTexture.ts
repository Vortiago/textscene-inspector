/**
 * A texture sampled without the sRGB decode that `textureProcessing.ts` tags on every
 * load, for the 2D canvas, which filters undecoded bytes (`canvas2DTextureDecode.ts`),
 * and the vendored theme icons and sprite frames. A 3D material decides per slot in
 * `resources/materials/standardmaterial3d/textureBinding.ts`, not here.
 */
import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { pinNoColorSpace } from '../resources/textures/applyTextureState';

// Re-exported for the 2D consumers. It lives beside the shared texture applier,
// which the material path also needs.
export { pinNoColorSpace };

/**
 * An undecoded (`NoColorSpace`) view of a shared texture: a clone, since `useResource`
 * hands every consumer the same cached texture and an in-place retag would flip an
 * albedo elsewhere. Memoised on the input, disposed on replacement or unmount, `null`
 * while there is nothing to show.
 */
export function useUndecodedTexture(
  texture: THREE.Texture | null | undefined
): THREE.Texture | null {
  const cloned = useMemo(() => {
    if (!texture) return null;
    const clone = texture.clone();
    pinNoColorSpace(clone);
    clone.needsUpdate = true;
    return clone;
  }, [texture]);
  useEffect(() => (cloned ? () => cloned.dispose() : undefined), [cloned]);
  return cloned;
}
