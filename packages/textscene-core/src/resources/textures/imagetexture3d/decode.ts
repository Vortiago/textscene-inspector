/**
 * Decodes an `ImageTexture3D`, whose `_images` hold its slices as inline `Image` sub-resources
 * (`scene/resources/image_texture.cpp:467-505`), to the volume's texels. No THREE.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { splitTopLevel } from '../../../godot/index.js';
import { arrayLiteralBody } from '../../../godot/variantParser.js';
import type { Texture3DTexels } from '../../formats/image3d/texels';
import { decodeImageRef, type DecodedImage } from '../image/decode';
import { stackSlices } from './texels';

/** Null when an image fails to decode or the formats differ, which `_set_images` refuses (`:487`). */
export function decodeImageTexture3D(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): Texture3DTexels<Uint8Array | Float32Array> | null {
  const images = savedImages(properties._images, resources);
  if (!images || new Set(images.map(({ format }) => format)).size > 1) return null;
  return stackSlices(images);
}

/**
 * The `Image` sub-resources `_images` names, decoded, in order. Null when any element names no
 * Image or one `decodeImageRef` declines.
 */
function savedImages(
  value: string | undefined,
  resources: readonly TscnInternalResource[]
): DecodedImage[] | null {
  const body = value ? arrayLiteralBody(value) : null;
  if (body === null) return null;
  const images: DecodedImage[] = [];
  for (const element of splitTopLevel(body)) {
    if (element === '') continue;
    const decoded = decodeImageRef(element, resources);
    if (!decoded) return null;
    images.push(decoded);
  }
  return images;
}
