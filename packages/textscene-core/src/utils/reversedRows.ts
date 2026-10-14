/**
 * Row order of RGBA8 pixels. A typed-array `DataTexture` without `flipY` runs bottom-up in this
 * previewer, as UV v = 0 reads it, and a decoded image and Godot's `Image` run top-down.
 */

/** `rgba`'s rows in reverse order. Reversing twice gives back the input. */
export function reversedRows(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const reversed = new Uint8Array(rgba.length);
  const rowBytes = width * 4;
  for (let row = 0; row < height; row++) {
    reversed.set(rgba.subarray(row * rowBytes, (row + 1) * rowBytes), (height - 1 - row) * rowBytes);
  }
  return reversed;
}
