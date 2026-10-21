/**
 * `Image::generate_mipmaps` (`core/io/image.cpp:2146-2175`) on RGBA8 bytes: the mip chain Godot's
 * texture importer stores for an image with `mipmaps/generate` on. Each level averages the bytes of
 * the level above in their own space, so an sRGB image averages its encoded values.
 */

import { normalizedVector3 } from '../../godot/math/vector';
import { channelToByte } from '../../utils/colorSpace';

/** One level of an RGBA8 image, top row first. Its shape is the entry three reads from `Texture.mipmaps`. */
export interface MipLevel {
  data: Uint8Array;
  width: number;
  height: number;
}

export const RGBA_BYTES = 4;

/**
 * Every level of `base`'s chain, `base` first, down to 1 × 1 (`image.cpp:1885-1945`). With
 * `renormalize`, each generated level's RGB is a unit normal again (`renormalize_uint8`, `:4577-4588`).
 * The caller keeps `base`, which the chain shares.
 */
export function mipChain(base: MipLevel, renormalize: boolean): MipLevel[] {
  const expectedBytes = base.width * base.height * RGBA_BYTES;
  if (base.data.length !== expectedBytes) {
    throw new Error(
      `expected ${expectedBytes} bytes for a ${base.width}x${base.height} RGBA8 image, got ${base.data.length}`
    );
  }
  const levels = [base];
  for (let level = base; level.width > 1 || level.height > 1;) {
    level = halved(level, renormalize);
    levels.push(level);
  }
  return levels;
}

/**
 * `_generate_po2_mipmap` (`image.cpp:1947-1979`): each texel averages the 2 × 2 block at twice its
 * position, so an odd size drops its last column or row. A size of 1 averages the texel with itself.
 */
function halved(source: MipLevel, renormalize: boolean): MipLevel {
  const width = Math.max(source.width >> 1, 1);
  const height = Math.max(source.height >> 1, 1);
  const data = new Uint8Array(width * height * RGBA_BYTES);
  const rightStep = source.width === 1 ? 0 : RGBA_BYTES;
  const downStep = source.height === 1 ? 0 : source.width * RGBA_BYTES;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const up = 2 * y * downStep + 2 * x * rightStep;
      const down = up + downStep;
      const out = (y * width + x) * RGBA_BYTES;
      for (let c = 0; c < RGBA_BYTES; c++) {
        data[out + c] = average4(source.data, up + c, up + c + rightStep, down + c, down + c + rightStep);
      }
      if (renormalize) renormalizeTexel(data, out);
    }
  }
  return { data, width, height };
}

/** `Image::average_4_uint8` (`image.cpp:4549-4551`). */
function average4(data: Uint8Array, a: number, b: number, c: number, d: number): number {
  return (data[a]! + data[b]! + data[c]! + data[d]! + 2) >> 2;
}

/** `Image::renormalize_uint8`, in the float32 of its `Vector3`, rounded to the nearest byte. */
function renormalizeTexel(data: Uint8Array, index: number): void {
  const [x, y, z] = normalizedVector3(
    SIGNED_UNIT_BY_BYTE[data[index]!]!,
    SIGNED_UNIT_BY_BYTE[data[index + 1]!]!,
    SIGNED_UNIT_BY_BYTE[data[index + 2]!]!
  );
  data[index] = toByte(x);
  data[index + 1] = toByte(y);
  data[index + 2] = toByte(z);
}

/** A byte as the `-1..1` float32 `renormalize_uint8` reads, one entry per byte value. */
const SIGNED_UNIT_BY_BYTE = Float32Array.from(
  { length: 256 },
  (_, byte) => Math.fround(Math.fround(byte / 255) * 2) - 1
);

function toByte(signedUnit: number): number {
  return channelToByte(Math.fround(Math.fround(signedUnit + 1) * 0.5));
}
