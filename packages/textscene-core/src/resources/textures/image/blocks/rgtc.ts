/**
 * The RGTC (BC4 and BC5) block formats: one or two channels, each an interpolated 8-byte block.
 * Godot samples them through the swizzles `r001` and `rg01` (`texture_storage.cpp:2042-2071`).
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

/**
 * Writes one channel of the block at `offset`, as `bcdec__smooth_alpha_block` decodes it
 * (`bcdec.h:197-238`): two endpoints, then a 3-bit index per texel into six values between them,
 * or into four and the ends 0 and 255 when the first endpoint is not above the second.
 */
export function decodeInterpolatedChannel(
  bytes: Uint8Array,
  offset: number,
  texels: Uint8Array,
  channel: number
): void {
  const palette = channelPalette(bytes[offset]!, bytes[offset + 1]!);
  let indices = 0;
  for (let i = 5; i >= 0; i--) indices = indices * 256 + bytes[offset + 2 + i]!;
  for (let texel = 0; texel < 16; texel++) {
    texels[texel * 4 + channel] = palette[indices % 8]!;
    indices = Math.floor(indices / 8);
  }
}

function channelPalette(first: number, second: number): number[] {
  const palette = [first, second];
  if (first > second) {
    for (let step = 1; step <= 6; step++)
      palette.push(Math.floor(((7 - step) * first + step * second + 1) / 7));
  } else {
    for (let step = 1; step <= 4; step++)
      palette.push(Math.floor(((5 - step) * first + step * second + 1) / 5));
    palette.push(0, 255);
  }
  return palette;
}

function decodeRgtcRed(bytes: Uint8Array, offset: number, texels: Uint8Array): void {
  decodeInterpolatedChannel(bytes, offset, texels, 0);
  fillChannels(texels, 1, 0, 0, 255);
}

function decodeRgtcRedGreen(bytes: Uint8Array, offset: number, texels: Uint8Array): void {
  decodeInterpolatedChannel(bytes, offset, texels, 0);
  decodeInterpolatedChannel(bytes, offset + 8, texels, 1);
  fillChannels(texels, 2, 0, 255);
}

/** Sets every channel from `first` to alpha to the values that follow it. */
export function fillChannels(texels: Uint8Array, first: number, ...values: number[]): void {
  for (let texel = 0; texel < 16; texel++) {
    for (let i = 0; i < values.length; i++) texels[texel * 4 + first + i] = values[i]!;
  }
}

export const RGTC_FORMATS: Readonly<Record<string, BlockFormat>> = {
  'RGTC Red8': { bytesPerBlock: 8, decode: decodeRgtcRed },
  'RGTC RedGreen8': { bytesPerBlock: 16, decode: decodeRgtcRedGreen },
};
