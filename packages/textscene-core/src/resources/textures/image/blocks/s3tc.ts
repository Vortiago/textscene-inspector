/**
 * The S3TC (BC1 to BC3) block formats: a 565 colour block, after an alpha block in DXT3 and DXT5.
 * Godot samples them through the swizzles `rgb1`, `rgba`, `rgba` and, for DXT5_RA_AS_RG, `ra01`
 * (`texture_storage.cpp:1997-2041`, `:2246-2261`).
 *
 * Ported from bcdec (`thirdparty/misc/bcdec.h` in Godot), used under the MIT licence:
 *
 *   Copyright (c) 2022 Sergii Kudlai
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of
 *   this software and associated documentation files (the "Software"), to deal in
 *   the Software without restriction, including without limitation the rights to
 *   use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 *   of the Software, and to permit persons to whom the Software is furnished to do
 *   so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
 */

import type { BlockFormat } from './decodeBlocks';
import { keepRedGreen } from '../../../processing/importTexelPasses';
import { decodeInterpolatedChannel } from './channels';

/** Four RGBA8 entries, written by each `decodeColourBlock` call and read before it returns. */
const colourPalette = new Uint8Array(16);

/**
 * Writes the RGBA of the colour block at `offset`, as `bcdec__color_block` decodes it
 * (`bcdec.h:111-178`). A block whose first endpoint is not above the second holds three colours
 * and black, unless `isAlwaysFourColours`, as DXT3 and DXT5 read every colour block.
 */
function decodeColourBlock(
  bytes: Uint8Array,
  offset: number,
  texels: Uint8Array,
  isAlwaysFourColours: boolean
): void {
  const first = readUint16(bytes, offset);
  const second = readUint16(bytes, offset + 2);
  writeExpanded(0, first);
  writeExpanded(4, second);
  if (first > second || isAlwaysFourColours) {
    writeThird(8, first, second);
    writeThird(12, second, first);
  } else {
    writeHalf(8, first, second);
    // bcdec writes this entry transparent, but the DXT1 swizzle reads alpha as one
    // (`texture_storage.cpp:2011`), and DXT3 and DXT5 never reach it.
    writeEntry(12, 0, 0, 0);
  }
  for (let texel = 0; texel < 16; texel++) {
    const entry = ((bytes[offset + 4 + (texel >> 2)]! >> ((texel & 3) * 2)) & 3) * 4;
    const at = texel * 4;
    texels[at] = colourPalette[entry]!;
    texels[at + 1] = colourPalette[entry + 1]!;
    texels[at + 2] = colourPalette[entry + 2]!;
    texels[at + 3] = colourPalette[entry + 3]!;
  }
}

function writeExpanded(at: number, packed: number): void {
  writeEntry(
    at,
    (red(packed) * 527 + 23) >> 6,
    (green(packed) * 259 + 33) >> 6,
    (blue(packed) * 527 + 23) >> 6
  );
}

/**
 * Two thirds of `near` and one of `far`. bcdec's integer weights match a float interpolation
 * rounded to nearest, where a GPU that decodes in hardware can round 1/255 apart.
 */
function writeThird(at: number, near: number, far: number): void {
  writeEntry(
    at,
    ((2 * red(near) + red(far)) * 351 + 61) >> 7,
    ((2 * green(near) + green(far)) * 2763 + 1039) >> 11,
    ((2 * blue(near) + blue(far)) * 351 + 61) >> 7
  );
}

function writeHalf(at: number, first: number, second: number): void {
  writeEntry(
    at,
    ((red(first) + red(second)) * 1053 + 125) >> 8,
    ((green(first) + green(second)) * 4145 + 1019) >> 11,
    ((blue(first) + blue(second)) * 1053 + 125) >> 8
  );
}

function writeEntry(at: number, r: number, g: number, b: number): void {
  colourPalette[at] = r;
  colourPalette[at + 1] = g;
  colourPalette[at + 2] = b;
  colourPalette[at + 3] = 255;
}

function red(packed565: number): number {
  return (packed565 >> 11) & 0x1f;
}

function green(packed565: number): number {
  return (packed565 >> 5) & 0x3f;
}

function blue(packed565: number): number {
  return packed565 & 0x1f;
}

/** `bcdec__sharp_alpha_block` (`bcdec.h:180-195`): a 4-bit alpha per texel, row by row. */
function decodeExplicitAlpha(bytes: Uint8Array, offset: number, texels: Uint8Array): void {
  for (let texel = 0; texel < 16; texel++) {
    const nibble = (bytes[offset + (texel >> 1)]! >> ((texel & 1) * 4)) & 0xf;
    texels[texel * 4 + 3] = nibble * 17;
  }
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function decodeDxt1(bytes: Uint8Array, offset: number, texels: Uint8Array): void {
  decodeColourBlock(bytes, offset, texels, false);
}

function decodeDxt3(bytes: Uint8Array, offset: number, texels: Uint8Array): void {
  decodeColourBlock(bytes, offset + 8, texels, true);
  decodeExplicitAlpha(bytes, offset, texels);
}

function decodeDxt5(bytes: Uint8Array, offset: number, texels: Uint8Array): void {
  decodeColourBlock(bytes, offset + 8, texels, true);
  decodeInterpolatedChannel(bytes, offset, texels, 3);
}

/** A DXT5 block that carries red in red and green in alpha (`image_decompress_bcdec.cpp:297-299`). */
function decodeDxt5RaAsRg(bytes: Uint8Array, offset: number, texels: Uint8Array): void {
  decodeDxt5(bytes, offset, texels);
  for (let at = 0; at < texels.length; at += 4) texels[at + 1] = texels[at + 3]!;
  keepRedGreen(texels);
}

export const S3TC_FORMATS: Readonly<Record<string, BlockFormat>> = {
  'DXT1 RGB8': { bytesPerBlock: 8, decode: decodeDxt1 },
  'DXT3 RGBA8': { bytesPerBlock: 16, decode: decodeDxt3 },
  'DXT5 RGBA8': { bytesPerBlock: 16, decode: decodeDxt5 },
  FORMAT_DXT5_RA_AS_RG: { bytesPerBlock: 16, decode: decodeDxt5RaAsRg },
};
