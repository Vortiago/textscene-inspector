/**
 * The slices an ImageTexture3D saves, stacked into one volume as `_set_images` stacks them
 * (`scene/resources/image_texture.cpp:467-505`). It reads decoded pixels, so a test runs it
 * without a browser.
 */

import type { LayeredTexels } from '../layeredTexels';
import type { DecodedLevel } from '../image/decode';
import { emptyLike } from '../../../utils/emptyLike';

/**
 * The first image sets the size. The first image of another size starts the mipmaps, so the
 * depth is the count before it (`:484-499`). Null with no image, which `_set_images` leaves
 * without a texture.
 */
export function stackSlices(
  images: readonly DecodedLevel[]
): LayeredTexels<Uint8Array | Float32Array> | null {
  const first = images[0];
  if (!first) return null;
  const { width, height } = first;
  const mipmapStart = images.findIndex((image) => image.width !== width || image.height !== height);
  const depth = mipmapStart === -1 ? images.length : mipmapStart;

  const sliceTexels = width * height * 4;
  const texels = emptyLike(first.data, sliceTexels * depth);
  for (let z = 0; z < depth; z++) texels.set(images[z]!.data, z * sliceTexels);
  return { texels, width, height, depth };
}
