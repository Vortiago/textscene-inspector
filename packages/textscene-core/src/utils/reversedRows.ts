/**
 * Row order of RGBA pixels. A typed-array `DataTexture` without `flipY` runs bottom-up in this
 * previewer, as UV v = 0 reads it, and a decoded image and Godot's `Image` run top-down.
 */

import { emptyLike, type Pixels, type PlainPixelsOf } from './emptyLike';

/**
 * `rgba`'s rows in reverse order, floats and half-float bits in their own type and bytes in a
 * plain `Uint8Array`. Reversing twice gives back the input.
 *
 * @canonical Row order of RGBA pixels
 */
export function reversedRows<Source extends Pixels>(
  rgba: Source,
  width: number,
  height: number
): PlainPixelsOf<Source> {
  const reversed = emptyLike(rgba, rgba.length);
  const rowTexels = width * 4;
  for (let row = 0; row < height; row++) {
    reversed.set(rgba.subarray(row * rowTexels, (row + 1) * rowTexels), (height - 1 - row) * rowTexels);
  }
  return reversed;
}

/**
 * Reverses the rows of `rgba` where they lie, through one row of scratch: no second buffer.
 *
 * @canonical Row order of RGBA pixels
 */
export function reverseRowsInPlace(rgba: Pixels, width: number, height: number): void {
  const rowTexels = width * 4;
  const scratch = emptyLike(rgba, rowTexels);
  for (let top = 0, bottom = height - 1; top < bottom; top++, bottom--) {
    const topRow = rgba.subarray(top * rowTexels, (top + 1) * rowTexels);
    const bottomRow = rgba.subarray(bottom * rowTexels, (bottom + 1) * rowTexels);
    scratch.set(topRow);
    topRow.set(bottomRow);
    bottomRow.set(scratch);
  }
}

/**
 * Whether `texture`'s pixels run bottom-up: a typed array that uploads without `flipY`. A typed
 * array with `flipY`, such as `applyAlphaBorderFix`'s readback of a decoded image, runs top-down.
 *
 * @canonical Row order of RGBA pixels
 */
export function isBottomUp(texture: { flipY: boolean; image: unknown }): boolean {
  return !texture.flipY && ArrayBuffer.isView((texture.image as { data?: unknown } | null)?.data);
}
