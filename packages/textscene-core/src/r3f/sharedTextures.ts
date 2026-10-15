/**
 * Textures every renderer shares, freed from each renderer when a canvas unmounts. three leaves a
 * dispose listener that closes over each renderer that uploads a texture (r186
 * `WebGLTextures.js:719`), so a texture that outlives its canvas keeps that renderer reachable.
 */

import { useEffect } from 'react';
import type * as THREE from 'three';

/**
 * Written only by `sharedTexture`, and never cleared: a disposed texture stays usable, and a live
 * renderer uploads it again at its next draw. A texture here is shared, not made per renderer like a
 * pass, as a material's uniform getter and three's `UniformsLib` read it with no renderer at hand.
 */
const textures = new Set<THREE.Texture>();

/** `texture`, which every canvas that unmounts frees from its renderer. */
export function sharedTexture<T extends THREE.Texture>(texture: T): T {
  textures.add(texture);
  return texture;
}

/** Frees each shared texture from every renderer when the canvas it sits in unmounts. */
export function SharedTextureRelease(): null {
  useEffect(
    () => () => {
      for (const texture of textures) texture.dispose();
    },
    []
  );
  return null;
}
