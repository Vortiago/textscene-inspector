/**
 * `Image::generate_mipmap_roughness` (`core/io/image.cpp:2177-2343`): the roughness limiter Godot's
 * texture importer runs on a roughness map's mip chain when its sidecar names a normal map. Each
 * level's roughness rises by the spread of the normals it covers, so a minified bumpy surface keeps
 * its blur where its averaged normals have gone flat.
 */

import {
  isGreyscaleSource,
  storesAlpha,
  type ImageSourceFormat,
} from '../../godot/import/imageSourceFormat.js';
import { RoughnessChannel } from '../../godot/import/textureImport';
import type { ImagePixels } from '../formats/image/imagePixels';
import { byteOf, channelOf } from '../../godot/project/image.js';
import type { MipLevel } from './mipChain';
import type { EnumValue } from '../../godot/classdb/enumNames.js';

/** The channel the limiter raises, and the format the import holds, which decides the write. */
interface RoughnessTarget {
  channel: EnumValue<typeof RoughnessChannel>;
  source: ImageSourceFormat | null;
}

/** The summed area table of the normals, three doubles a texel, and the normal map's size. */
interface SummedNormals {
  table: Float64Array;
  width: number;
  height: number;
}

/** The normal-map texels one level texel covers, first and last column and row inclusive. */
interface Box {
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
}

type TexelLimiter = (data: Uint8Array, at: number, spread: number) => void;

/** `threshold` (`image.cpp:2314`), squared in float as Godot squares it. */
const VARIANCE_LIMIT = Math.fround(Math.fround(0.4) * Math.fround(0.4));

/** Raises the roughness of every level after the first, in place. `levels` runs top row first. */
export function limitRoughness(levels: MipLevel[], normal: ImagePixels, target: RoughnessTarget): void {
  const normals = summedNormals(normal);
  const limitTexel = texelLimiter(target);
  for (let i = 1; i < levels.length; i++) limitLevel(levels[i]!, normals, limitTexel);
}

/** The summed area table of `normal` (`image.cpp:2193-2221`). */
function summedNormals({ data, width, height }: ImagePixels): SummedNormals {
  const table = new Float64Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    let lineX = 0;
    let lineY = 0;
    let lineZ = 0;
    for (let x = 0; x < width; x++) {
      const texel = y * width + x;
      const nx = channelOf(data[texel * 4]!) * 2 - 1;
      const ny = channelOf(data[texel * 4 + 1]!) * 2 - 1;
      // Godot rebuilds z from x and y, whatever the blue byte holds.
      const nz = Math.sqrt(Math.max(0, 1 - (nx * nx + ny * ny)));
      lineX += nx;
      lineY += ny;
      lineZ += nz;
      const at = texel * 3;
      const above = at - width * 3;
      table[at] = lineX + (y > 0 ? table[above]! : 0);
      table[at + 1] = lineY + (y > 0 ? table[above + 1]! : 0);
      table[at + 2] = lineZ + (y > 0 ? table[above + 2]! : 0);
    }
  }
  return { table, width, height };
}

function limitLevel(level: MipLevel, normals: SummedNormals, limitTexel: TexelLimiter): void {
  const columns = boxBounds(normals.width, level.width);
  const rows = boxBounds(normals.height, level.height);
  const box: Box = { fromX: 0, toX: 0, fromY: 0, toY: 0 };
  for (let y = 0; y < level.height; y++) {
    box.fromY = rows[y * 2]!;
    box.toY = rows[y * 2 + 1]!;
    for (let x = 0; x < level.width; x++) {
      box.fromX = columns[x * 2]!;
      box.toX = columns[x * 2 + 1]!;
      limitTexel(level.data, (y * level.width + x) * 4, normalSpread(normals, box));
    }
  }
}

/**
 * Each level texel's first and last normal-map texel along one axis (`image.cpp:2245-2248`), as
 * pairs. Godot clamps the last to `size`, not `size - 1`, and the bounds keep that.
 */
function boxBounds(size: number, levelSize: number): Int32Array {
  const bounds = new Int32Array(levelSize * 2);
  for (let i = 0; i < levelSize; i++) {
    bounds[i * 2] = Math.floor((i * size) / levelSize);
    bounds[i * 2 + 1] = Math.min(Math.floor(((i + 1) * size) / levelSize) - 1, size);
  }
  return bounds;
}

/** The length of the mean normal in `box` (`image.cpp:2250-2287`). An empty box divides by zero, as in Godot. */
function normalSpread(normals: SummedNormals, box: Box): number {
  const area = (box.toX - box.fromX + 1) * (box.toY - box.fromY + 1);
  const mx = Math.fround(boxTotal(normals, box, 0) / area);
  const my = Math.fround(boxTotal(normals, box, 1) / area);
  const mz = Math.fround(boxTotal(normals, box, 2) / area);
  // `Vector3::length` in float.
  const lengthSquared = Math.fround(
    Math.fround(Math.fround(mx * mx) + Math.fround(my * my)) + Math.fround(mz * mz)
  );
  return Math.fround(Math.sqrt(lengthSquared));
}

/** Component `c` of the normals in `box`, from the table's corners. Godot skips a corner at column or row 0. */
function boxTotal({ table, width }: SummedNormals, { fromX, toX, fromY, toY }: Box, c: number): number {
  let total = 0;
  if (fromX > 0 && fromY > 0) total += table[((fromY - 1) * width + fromX - 1) * 3 + c]!;
  if (fromY > 0 && toX > 0) total -= table[((fromY - 1) * width + toX) * 3 + c]!;
  if (fromX > 0 && toY > 0) total -= table[(toY * width + fromX - 1) * 3 + c]!;
  if (toY > 0 && toX > 0) total += table[(toY * width + toX) * 3 + c]!;
  return total;
}

/**
 * Reads a texel as `Image::get_pixel` does, raises its roughness, and writes it back as
 * `Image::_set_color_at_ofs` does (`image.cpp:3555-3600`): every stored channel is rewritten.
 */
function texelLimiter({ channel, source }: RoughnessTarget): TexelLimiter {
  // A Float32Array holds each channel as the float Godot's `Color` holds it.
  const color = new Float32Array(4);
  const isLuminance = channel === RoughnessChannel.L;
  const written = isLuminance ? [0, 1, 2] : [channel];
  const isGreyscale = isGreyscaleSource(source);
  const hasAlpha = storesAlpha(source);
  return (data, at, spread) => {
    for (let c = 0; c < 4; c++) color[c] = channelOf(data[at + c]!);
    const limited = raisedRoughness(isLuminance ? brightest(color) : color[channel]!, spread);
    for (const c of written) color[c] = limited;
    const grey = isGreyscale ? brightest(color) : 0;
    for (let c = 0; c < 3; c++) data[at + c] = byteOf(isGreyscale ? grey : color[c]!);
    if (hasAlpha) data[at + 3] = byteOf(color[3]!);
  };
}

/** `Color::get_v`: the brightest of red, green and blue. A greyscale format stores it as its grey. */
function brightest(color: Float32Array): number {
  return Math.max(color[0]!, color[1]!, color[2]!);
}

/** `roughness` raised by the variance of a mean normal of length `spread` (`image.cpp:2309-2318`). */
function raisedRoughness(roughness: number, spread: number): number {
  const added = Math.min(Math.fround(3 * variance(spread)), VARIANCE_LIMIT);
  return Math.fround(Math.sqrt(Math.fround(Math.fround(roughness * roughness) + added)));
}

/** The vMF variance of a mean normal of length `r` (`image.cpp:2309-2314`), zero when it is unit or longer. */
function variance(r: number): number {
  if (!(r < 1)) return 0;
  const r2 = Math.fround(r * r);
  const kappa = Math.fround(Math.fround(Math.fround(3 * r) - Math.fround(r * r2)) / Math.fround(1 - r2));
  return Math.fround(0.25 / kappa);
}
