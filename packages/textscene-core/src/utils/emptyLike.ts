/** A zeroed buffer of the same texel kind as some pixels, for a copy or a scratch row. */

/** RGBA pixels: bytes, half-float bits or floats. */
export type Pixels = Uint8Array | Uint8ClampedArray | Uint16Array | Float32Array;

/** Floats and half-float bits keep their type, and bytes land in a plain `Uint8Array`. */
export type PlainPixelsOf<Source extends Pixels> = Source extends Float32Array
  ? Float32Array
  : Source extends Uint16Array
    ? Uint16Array
    : Uint8Array;

/**
 * A zeroed buffer of `length` texels, of the kind `pixels` holds.
 *
 * @oneWay A buffer of the same texel kind as some pixels
 */
export function emptyLike<Source extends Pixels>(pixels: Source, length: number): PlainPixelsOf<Source> {
  if (pixels instanceof Float32Array) return new Float32Array(length) as PlainPixelsOf<Source>;
  if (pixels instanceof Uint16Array) return new Uint16Array(length) as PlainPixelsOf<Source>;
  return new Uint8Array(length) as PlainPixelsOf<Source>;
}

/**
 * Whether `pixels` already has the texel kind `emptyLike` would give it, so a copy can share them.
 *
 * @oneWay A buffer of the same texel kind as some pixels
 */
export function isPlainPixels<Source extends Pixels>(pixels: Source): pixels is Source & PlainPixelsOf<Source> {
  return !(pixels instanceof Uint8ClampedArray);
}
