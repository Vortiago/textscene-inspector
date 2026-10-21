/**
 * The interpolated 8-bit channel of BC3 alpha, BC4 and BC5.
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

/** Written by each `decodeInterpolatedChannel` call and read before it returns. */
const channelPalette = new Uint8Array(8);

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
  writeChannelPalette(bytes[offset]!, bytes[offset + 1]!);
  // Two 24-bit halves of eight indices each: the 32-bit integer operators cannot hold all 48 bits.
  const firstHalf = readUint24(bytes, offset + 2);
  const secondHalf = readUint24(bytes, offset + 5);
  for (let texel = 0; texel < 16; texel++) {
    const index = ((texel < 8 ? firstHalf : secondHalf) >> ((texel & 7) * 3)) & 7;
    texels[texel * 4 + channel] = channelPalette[index]!;
  }
}

function writeChannelPalette(first: number, second: number): void {
  const steps = first > second ? 7 : 5;
  channelPalette[0] = first;
  channelPalette[1] = second;
  for (let step = 1; step < steps; step++) {
    channelPalette[step + 1] = Math.floor(((steps - step) * first + step * second + 1) / steps);
  }
  if (steps === 5) {
    channelPalette[6] = 0;
    channelPalette[7] = 255;
  }
}

function readUint24(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}
