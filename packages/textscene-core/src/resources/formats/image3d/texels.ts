/**
 * The texels of an image cut into the slices of a 3D texture, as Godot's layered importer cuts it
 * (`editor/import/resource_importer_layered_texture.cpp:370-386`). It reads decoded pixels, so a
 * test runs it without a browser.
 */

import type { ImagePixels } from '../image/imagePixels';
import type { ImportSlices } from '../../../godot/import/texture3DImport';

/** RGBA texels, slice after slice, each slice's rows from the top. */
export interface Texture3DTexels<Texels extends Uint8Array | Float32Array = Uint8Array> {
  texels: Texels;
  width: number;
  height: number;
  depth: number;
}

/**
 * Each slice is the image's size over the counts, truncated, so a remainder column or row is
 * dropped. Slices run left to right, then top to bottom. Null when a slice is empty, which
 * Godot skips (`:380`), leaving no volume.
 */
export function sliceImage(
  image: ImagePixels,
  { horizontal, vertical }: ImportSlices
): Texture3DTexels | null {
  const width = Math.trunc(image.width / horizontal);
  const height = Math.trunc(image.height / vertical);
  if (width < 1 || height < 1) return null;
  const depth = horizontal * vertical;
  const texels = new Uint8Array(width * height * depth * 4);
  const rowBytes = width * 4;
  for (let slice = 0; slice < depth; slice++) {
    const left = (slice % horizontal) * width;
    const top = Math.trunc(slice / horizontal) * height;
    for (let y = 0; y < height; y++) {
      const source = ((top + y) * image.width + left) * 4;
      texels.set(image.data.subarray(source, source + rowBytes), (slice * height + y) * rowBytes);
    }
  }
  return { texels, width, height, depth };
}
