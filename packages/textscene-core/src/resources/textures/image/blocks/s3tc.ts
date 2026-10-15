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
import { decodeInterpolatedChannel, fillChannels } from './rgtc';

/**
 * Writes the RGBA of the colour block at `offset`, as `bcdec__color_block` decodes it
 * (`bcdec.h:111-178`). A block whose first endpoint is not above the second holds three colours
 * and a transparent black, unless `isOpaque`, as DXT3 and DXT5 read every colour block.
 */
function decodeColourBlock(bytes: Uint8Array, offset: number, texels: Uint8Array, isOpaque: boolean): void {
  const first = readUint16(bytes, offset);
  const second = readUint16(bytes, offset + 2);
  const palette = colourPalette(unpack565(first), unpack565(second), first > second || isOpaque);
  for (let texel = 0; texel < 16; texel++) {
    const index = (bytes[offset + 4 + (texel >> 2)]! >> ((texel & 3) * 2)) & 3;
    texels.set(palette[index]!, texel * 4);
  }
}

type Rgb565 = readonly [red: number, green: number, blue: number];

function unpack565(packed: number): Rgb565 {
  return [(packed >> 11) & 0x1f, (packed >> 5) & 0x3f, packed & 0x1f];
}

/**
 * The four RGBA8 entries of a colour block. bcdec's integer weights match a float interpolation
 * rounded to nearest; a GPU that decodes in hardware can round an interpolated entry 1/255 apart.
 */
function colourPalette(first: Rgb565, second: Rgb565, hasFourColours: boolean): number[][] {
  const expand = ([r, g, b]: Rgb565) => [(r * 527 + 23) >> 6, (g * 259 + 33) >> 6, (b * 527 + 23) >> 6, 255];
  if (hasFourColours) {
    const third = ([r0, g0, b0]: Rgb565, [r1, g1, b1]: Rgb565) => [
      ((2 * r0 + r1) * 351 + 61) >> 7,
      ((2 * g0 + g1) * 2763 + 1039) >> 11,
      ((2 * b0 + b1) * 351 + 61) >> 7,
      255,
    ];
    return [expand(first), expand(second), third(first, second), third(second, first)];
  }
  const [r0, g0, b0] = first;
  const [r1, g1, b1] = second;
  const half = [
    ((r0 + r1) * 1053 + 125) >> 8,
    ((g0 + g1) * 4145 + 1019) >> 11,
    ((b0 + b1) * 1053 + 125) >> 8,
    255,
  ];
  return [expand(first), expand(second), half, [0, 0, 0, 0]];
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

/** The swizzle reads alpha as one (`texture_storage.cpp:2011`), so a transparent entry draws black. */
function decodeDxt1(bytes: Uint8Array, offset: number, texels: Uint8Array): void {
  decodeColourBlock(bytes, offset, texels, false);
  fillChannels(texels, 3, 255);
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
  for (let texel = 0; texel < 16; texel++) texels[texel * 4 + 1] = texels[texel * 4 + 3]!;
  fillChannels(texels, 2, 0, 255);
}

export const S3TC_FORMATS: Readonly<Record<string, BlockFormat>> = {
  'DXT1 RGB8': { bytesPerBlock: 8, decode: decodeDxt1 },
  'DXT3 RGBA8': { bytesPerBlock: 16, decode: decodeDxt3 },
  'DXT5 RGBA8': { bytesPerBlock: 16, decode: decodeDxt5 },
  FORMAT_DXT5_RA_AS_RG: { bytesPerBlock: 16, decode: decodeDxt5RaAsRg },
};
