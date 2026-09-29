/**
 * Points a sprite's drawn texture at its frame's UV window. The window is material
 * state, read into the map transform at each draw, so a frame change needs no new
 * texture and no upload.
 */
import { useLayoutEffect } from 'react';
import type * as THREE from 'three';
import type { UvWindow } from './spriteFrame';

/**
 * `texture` is the consumer's own clone, and may be the previous one while a new
 * clone uploads: that one shows the new window over its own pixels. Layout, not
 * passive: the window is set before the frame that first draws the texture.
 */
export function useUvWindow(texture: THREE.Texture | null, window: UvWindow): void {
  useLayoutEffect(() => {
    if (!texture) return;
    texture.offset.copy(window.offset);
    texture.repeat.copy(window.repeat);
  }, [texture, window]);
}
