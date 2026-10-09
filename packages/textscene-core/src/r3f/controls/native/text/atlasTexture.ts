/**
 * The vendored Open Sans MSDF atlas as one shared texture, and whether its image has decoded. A
 * glyph quad drawn before the decode samples an empty texture, so a run counts as pending until then.
 */

import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { OPEN_SANS_ATLAS_PNG_DATA_URL } from './openSansAtlas';

/** Written only by `getAtlasTexture`. Never cleared: the atlas is never disposed. */
let cachedAtlasTexture: THREE.Texture | null = null;
/** Set only by the atlas image's load callback, and never cleared. */
let isAtlasDecoded = false;
const decodeListeners = new Set<() => void>();

function markDecoded(): void {
  isAtlasDecoded = true;
  decodeListeners.forEach((listener) => listener());
}

/**
 * The atlas PNG as a texture, created once and shared by identity across every run, never
 * disposed. MSDF channels are distance data, not colour, so `NoColorSpace` keeps them from being
 * gamma-decoded.
 */
export function getAtlasTexture(): THREE.Texture {
  if (!cachedAtlasTexture) {
    const texture = new THREE.TextureLoader().load(OPEN_SANS_ATLAS_PNG_DATA_URL, markDecoded);
    texture.colorSpace = THREE.NoColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    cachedAtlasTexture = texture;
  }
  return cachedAtlasTexture;
}

function subscribeDecode(listener: () => void): () => void {
  decodeListeners.add(listener);
  return () => decodeListeners.delete(listener);
}

/** Whether the atlas image has decoded, re-rendering the caller when it does. */
export function useIsAtlasDecoded(): boolean {
  return useSyncExternalStore(subscribeDecode, () => isAtlasDecoded);
}
