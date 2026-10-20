/**
 * Decodes the top level of a block-compressed image: 4 × 4 texel blocks, left to right and top
 * row first, with each edge padded up to a whole block (`core/io/image.cpp:1885-1925`).
 */

import type { ImageSize } from '../../../formats/image/imagePixels';
import { RGTC_FORMATS } from './rgtc';
import { S3TC_FORMATS } from './s3tc';

/** Writes the 16 texels of the block at `offset` as the RGBA8 Godot samples, row by row. */
type BlockDecoder = (bytes: Uint8Array, offset: number, texels: Uint8Array) => void;

export interface BlockFormat {
  bytesPerBlock: number;
  decode: BlockDecoder;
}

/** Each block format a decoder handles, by the name `Image::format_names` gives it. */
export const BLOCK_FORMATS: Readonly<Record<string, BlockFormat>> = { ...S3TC_FORMATS, ...RGTC_FORMATS };

const BLOCK_SIDE = 4;

/** RGBA8 texels, or null for data shorter than the top level, which Godot refuses. */
export function decodeBlocks(
  bytes: Uint8Array,
  { width, height }: ImageSize,
  { bytesPerBlock, decode }: BlockFormat
): Uint8Array | null {
  const blocksWide = Math.ceil(width / BLOCK_SIDE);
  const blocksHigh = Math.ceil(height / BLOCK_SIDE);
  if (bytes.length < blocksWide * blocksHigh * bytesPerBlock) return null;
  const out = new Uint8Array(width * height * 4);
  const texels = new Uint8Array(BLOCK_SIDE * BLOCK_SIDE * 4);
  for (let blockY = 0; blockY < blocksHigh; blockY++) {
    for (let blockX = 0; blockX < blocksWide; blockX++) {
      decode(bytes, (blockY * blocksWide + blockX) * bytesPerBlock, texels);
      copyVisibleTexels(texels, out, width, height, blockX * BLOCK_SIDE, blockY * BLOCK_SIDE);
    }
  }
  return out;
}

/** Copies the part of a block inside the image, cropping the padding past its edges. */
function copyVisibleTexels(
  texels: Uint8Array,
  out: Uint8Array,
  width: number,
  height: number,
  left: number,
  top: number
): void {
  const rowBytes = Math.min(BLOCK_SIDE, width - left) * 4;
  const rows = Math.min(BLOCK_SIDE, height - top);
  for (let row = 0; row < rows; row++) {
    const from = row * BLOCK_SIDE * 4;
    const to = ((top + row) * width + left) * 4;
    for (let i = 0; i < rowBytes; i++) out[to + i] = texels[from + i]!;
  }
}
