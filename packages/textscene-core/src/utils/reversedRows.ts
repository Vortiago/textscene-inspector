/**
 * Row order of RGBA pixels. A typed-array `DataTexture` without `flipY` runs bottom-up in this
 * previewer, as UV v = 0 reads it, and a decoded image and Godot's `Image` run top-down.
 */

type Pixels = Uint8Array | Uint8ClampedArray | Uint16Array | Float32Array;

/** Floats and half-float bits keep their type, and bytes land in a plain `Uint8Array`. */
type ReversedPixels<Source extends Pixels> = Source extends Float32Array
  ? Float32Array
  : Source extends Uint16Array
    ? Uint16Array
    : Uint8Array;

/** `rgba`'s rows in reverse order. Reversing twice gives back the input. */
export function reversedRows<Source extends Pixels>(
  rgba: Source,
  width: number,
  height: number
): ReversedPixels<Source> {
  const reversed = emptyLike(rgba, rgba.length);
  const rowTexels = width * 4;
  for (let row = 0; row < height; row++) {
    reversed.set(rgba.subarray(row * rowTexels, (row + 1) * rowTexels), (height - 1 - row) * rowTexels);
  }
  return reversed as ReversedPixels<Source>;
}

/** Reverses the rows of `rgba` where they lie, through one row of scratch: no second buffer. */
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

function emptyLike(rgba: Pixels, length: number): Uint8Array | Uint16Array | Float32Array {
  if (rgba instanceof Float32Array) return new Float32Array(length);
  if (rgba instanceof Uint16Array) return new Uint16Array(length);
  return new Uint8Array(length);
}

/**
 * Whether `texture`'s pixels run bottom-up: a typed array that uploads without `flipY`. A typed
 * array with `flipY`, such as `applyAlphaBorderFix`'s readback of a decoded image, runs top-down.
 */
export function isBottomUp(texture: { flipY: boolean; image: unknown }): boolean {
  return !texture.flipY && ArrayBuffer.isView((texture.image as { data?: unknown } | null)?.data);
}
