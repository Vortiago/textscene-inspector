import type { LayeredTexels } from '../layeredTexels';
import type { SavedImage } from '../image/kind';
import { decodeImageTexture3D } from '../imagetexture3d/decode';

/** Godot refuses a cubemap of any other layer count (`image_texture.cpp:285-287`). */
export const CUBE_FACES = 6;

/** The six faces a Cubemap saves, stacked. Null for another count, or images Godot refuses to stack. */
export function decodeCubemapFaces(
  images: readonly SavedImage[]
): LayeredTexels<Uint8Array | Float32Array> | null {
  if (images.length !== CUBE_FACES) return null;
  const faces = decodeImageTexture3D(images);
  return faces?.depth === CUBE_FACES ? faces : null;
}
