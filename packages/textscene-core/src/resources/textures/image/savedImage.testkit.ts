/** An Image as Godot saves it, for the tests of the readers of its pixels. */

import type { SavedImage } from './kind';

/** The Image Dictionary of `width` by `height` texels of `format`, saving `bytes` as a `PackedByteArray`. */
export function savedImage(
  format: string,
  width: number,
  height: number,
  bytes: string,
  mipmaps: boolean | number = false
): SavedImage {
  return {
    dictionary: `{\n"data": PackedByteArray(${bytes}),\n"format": "${format}",\n"height": ${height},\n"mipmaps": ${mipmaps},\n"width": ${width}\n}`,
  };
}
