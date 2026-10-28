/**
 * What a ViewportTexture samples when Godot never sets it up for its scene: its proxy points at the
 * 2D placeholder, a magenta and black checkerboard four texels square with no mipmaps, magenta in
 * its top-left texel (`viewport.cpp:168-173`, `drivers/gles3/storage/texture_storage.cpp:259-267`).
 */

import * as THREE from 'three';
import { releasedOnUnmount } from '../../../r3f/sharedTexture';

const SIZE = 4;
const MAGENTA = [255, 0, 255, 255];
const BLACK = [0, 0, 0, 255];

/** Written once, on the first request. Every such slot shares it. */
let placeholder: THREE.DataTexture | undefined;

export function unconfiguredViewportTexture(): THREE.DataTexture {
  if (placeholder) return placeholder;
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let texel = 0; texel < SIZE * SIZE; texel++) {
    // Bottom-up, as a DataTexture uploads: Godot's row 0, the top one, is the last stored.
    const godotRow = SIZE - 1 - Math.floor(texel / SIZE);
    const isMagenta = ((texel % SIZE) + godotRow) % 2 === 0;
    data.set(isMagenta ? MAGENTA : BLACK, texel * 4);
  }
  placeholder = releasedOnUnmount(new THREE.DataTexture(data, SIZE, SIZE));
  placeholder.name = 'ViewportTexture placeholder';
  placeholder.colorSpace = THREE.SRGBColorSpace;
  placeholder.magFilter = THREE.LinearFilter;
  placeholder.minFilter = THREE.LinearFilter;
  placeholder.needsUpdate = true;
  return placeholder;
}
