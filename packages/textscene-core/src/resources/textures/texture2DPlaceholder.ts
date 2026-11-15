/**
 * Godot's 2D placeholder, a magenta and black checkerboard four texels square with no mipmaps,
 * magenta in its top-left texel (`texture_storage.cpp:588-595`). A texture that holds no image
 * samples it: a ViewportTexture its scene never sets up (`viewport.cpp:168-173`) and a
 * GradientTexture2D with no gradient (`gradient_texture.cpp:229-233,400`).
 */

import type * as THREE from 'three';
import { releasedOnUnmount } from '../../r3f/sharedTexture';
import { colourDataTexture } from './colourDataTexture';

const SIZE = 4;
const MAGENTA = [255, 0, 255, 255];
const BLACK = [0, 0, 0, 255];

/** Written once, on the first request. Every such slot shares it. */
let placeholder: THREE.DataTexture | undefined;

export function texture2DPlaceholder(): THREE.DataTexture {
  if (placeholder) return placeholder;
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let texel = 0; texel < SIZE * SIZE; texel++) {
    // Bottom-up, as a DataTexture uploads: Godot's row 0, the top one, is the last stored.
    const godotRow = SIZE - 1 - Math.floor(texel / SIZE);
    const isMagenta = ((texel % SIZE) + godotRow) % 2 === 0;
    data.set(isMagenta ? MAGENTA : BLACK, texel * 4);
  }
  placeholder = releasedOnUnmount(colourDataTexture(data, SIZE, SIZE, 'RGBA8'));
  placeholder.name = 'ViewportTexture placeholder';
  return placeholder;
}
