/**
 * Sampling a texture WITHOUT the sRGB decode — the shared primitive behind the
 * CANVAS consumers that need one.
 *
 * `textureProcessing.ts` tags every loaded texture `SRGBColorSpace`, which is
 * right for the colour maps that are the majority. Two kinds of consumer need
 * the opposite:
 *
 * - the 2D canvas, whose hardware filter must blend UNDECODED bytes and decode
 *   after (`canvas2DTextureDecode.ts`);
 * - the vendored theme icons and sprite frames, which reach the tag directly.
 *
 * A 3D material's non-colour maps used to be a third: they are now decided
 * where a material binds a texture to a SLOT
 * (`resources/materials/standardmaterial3d/textureBinding.ts`), which is the
 * only place that can name the slot and therefore the only place Godot's rule
 * can be read from. Nothing on the material path calls this hook.
 *
 * The retag is always on a CLONE. `useResource` hands the same cached
 * `THREE.Texture` to every consumer of a path, so mutating `colorSpace` in
 * place would flip it for every other consumer of that same path — including
 * the one legitimately using it as an albedo.
 */
import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { pinNoColorSpace } from '../resources/textures/applyTextureState';

// Re-exported from its home beside the shared texture applier, which is where
// the material path needs it too. The 2D consumers reach it through here
// because this module is where they have always found it.
export { pinNoColorSpace };

/**
 * An undecoded (`NoColorSpace`) view of a shared, cache-identity texture: a
 * clone retagged and pinned, memoised on the input's identity and disposed on
 * replacement/unmount.
 *
 * Returns `null` while there is nothing to show yet.
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
