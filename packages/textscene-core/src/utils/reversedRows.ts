/**
 * Row order of RGBA pixels. A typed-array `DataTexture` without `flipY` runs bottom-up in this
 * previewer, as UV v = 0 reads it, and a decoded image and Godot's `Image` run top-down.
 */

type Pixels = Uint8Array | Uint8ClampedArray | Float32Array;

/** Floats stay floats, and bytes land in a plain `Uint8Array`. */
type ReversedPixels<Source extends Pixels> = Source extends Float32Array ? Float32Array : Uint8Array;

/** `rgba`'s rows in reverse order. Reversing twice gives back the input. */
export function reversedRows<Source extends Pixels>(
  rgba: Source,
  width: number,
  height: number
): ReversedPixels<Source> {
  const reversed = rgba instanceof Float32Array ? new Float32Array(rgba.length) : new Uint8Array(rgba.length);
  const rowTexels = width * 4;
  for (let row = 0; row < height; row++) {
    reversed.set(rgba.subarray(row * rowTexels, (row + 1) * rowTexels), (height - 1 - row) * rowTexels);
  }
  return reversed as ReversedPixels<Source>;
}
