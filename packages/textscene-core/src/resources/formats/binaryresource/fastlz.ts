/**
 * FastLZ level 1 decompression, the codec of `Compression::MODE_FASTLZ` (`compression.cpp:161-174`).
 *
 * Ported from FastLZ's `fastlz1_decompress` (`thirdparty/misc/fastlz.c` in Godot), used under the
 * MIT licence:
 *
 *   Copyright (C) 2005-2020 Ariya Hidayat <ariya.hidayat@gmail.com>
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *   THE SOFTWARE.
 */

import { FASTLZ_LEVEL_2_FLAG } from '../../../godot/project/compressedFile';

/** A control byte below this starts a literal run. At or above it, a match. */
const MATCH_CONTROL = 32;

/** The 3-bit length field of a match whose length continues in the next byte. */
const LONG_MATCH_LENGTH = 6;

/** The shortest match FastLZ encodes, which a length field of 0 means. */
const MIN_MATCH = 3;

/**
 * The first `length` bytes `input` decodes to. Godot pads a block under 16 bytes to 16 before it
 * compresses it (`compression.cpp:59-61`), so the stream may decode to more than `length`.
 */
export function decompressFastLz(input: Uint8Array, length: number): Uint8Array {
  if (input[0]! & FASTLZ_LEVEL_2_FLAG) throw new Error('expected a FastLZ level 1 stream, got level 2');
  const output: number[] = [];
  // `fastlz1_decompress` stops once fewer than two bytes remain, as no item fits in one.
  const lastItemStart = input.length - 2;
  let at = 1;
  let control = input[0]! & (MATCH_CONTROL - 1);
  for (;;) {
    if (control >= MATCH_CONTROL) at = copyMatch(input, at, control, output);
    else {
      output.push(...input.subarray(at, at + control + 1));
      at += control + 1;
    }
    if (at > lastItemStart) break;
    control = input[at++]!;
  }
  if (output.length < length)
    throw new Error(`expected ${length} bytes from a FastLZ stream, got ${output.length}`);
  return new Uint8Array(output.slice(0, length));
}

/** Appends the match `control` starts, byte by byte as a match may overlap what it writes. */
function copyMatch(input: Uint8Array, at: number, control: number, output: number[]): number {
  let matchLength = (control >> 5) - 1;
  if (matchLength === LONG_MATCH_LENGTH) matchLength += input[at++]!;
  const distance = ((control & (MATCH_CONTROL - 1)) << 8) + input[at++]! + 1;
  if (distance > output.length) {
    throw new Error(
      `expected a FastLZ match within the ${output.length} bytes written, got one ${distance} back`
    );
  }
  const start = output.length - distance;
  for (let i = 0; i < matchLength + MIN_MATCH; i++) output.push(output[start + i]!);
  return at;
}
