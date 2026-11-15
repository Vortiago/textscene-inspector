/**
 * Decodes an `ImageTexture3D`, whose `_images` hold its slices as `Image` resources
 * (`scene/resources/image_texture.cpp:467-505`), to the volume's texels. No THREE.
 */

import { splitTopLevel } from '../../../godot/string/string.js';
import { arrayLiteralBody } from '../../../godot/variant/variantParser.js';
import type { LayeredTexels } from '../layeredTexels';
import { decodeImage, type DecodedImage } from '../image/decode';
import type { SavedImage } from '../image/kind';
import { stackSlices } from './texels';

/**
 * Null when an image fails to decode, for no image, or when the formats differ, which `_set_images`
 * refuses (`:487`).
 */
export function decodeImageTexture3D(
  images: readonly SavedImage[]
): LayeredTexels<Uint8Array | Float32Array> | null {
  const decoded: DecodedImage[] = [];
  for (const image of images) {
    const slice = decodeImage(image);
    if (!slice) return null;
    decoded.push(slice);
  }
  if (new Set(decoded.map(({ format }) => format)).size > 1) return null;
  return stackSlices(decoded);
}

/** The references `_images` holds, in order. Null for a value that is no array. */
export function imageReferences(value: string | undefined): string[] | null {
  const body = value ? arrayLiteralBody(value) : null;
  return body === null ? null : splitTopLevel(body).filter((element) => element !== '');
}
