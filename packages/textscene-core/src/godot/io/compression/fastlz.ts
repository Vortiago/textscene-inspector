/*
 * Ported from FastLZ's `fastlz_decompress` (thirdparty/misc/fastlz.c in Godot), under the MIT licence:
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

import { representableLength } from '../../variant/call/arrayLength.js';
import { UnportableUtility } from '../../variant/utility/unportableUtility.js';

/** `MAX_L2_DISTANCE` (fastlz.c:60). */
const MAX_L2_DISTANCE = 8191;

/** The bytes `fastlz_decompress` wrote, and whether it ran to the end or stopped on a bound check. */
export interface FastLzOutput {
  readonly written: Uint8Array;
  readonly isComplete: boolean;
}

class Decoder {
  private at = 0;
  private output = new Uint8Array(0);
  private length = 0;

  constructor(
    private readonly input: Uint8Array,
    private readonly maxout: number
  ) {}

  get position(): number {
    return this.at;
  }

  // A read past the input reads the heap after the PackedByteArray, which no port can repeat.
  next(): number {
    if (this.at >= this.input.length)
      throw new UnportableUtility('decompress of a FastLZ stream that reads past its end');
    return this.input[this.at++]!;
  }

  result(isComplete: boolean): FastLzOutput {
    return { written: this.output.slice(0, this.length), isComplete };
  }

  /** Room for `count` more bytes, doubling, so a buffer of any size costs only what is written. */
  private reserve(count: number): void {
    const needed = representableLength(this.length + count);
    if (needed <= this.output.length) return;
    const grown = new Uint8Array(Math.min(this.maxout, Math.max(needed, 2 * this.output.length)));
    grown.set(this.output.subarray(0, this.length));
    this.output = grown;
  }

  /** `fastlz_memcpy`: false where the run passes the input or the output. */
  copyLiteral(count: number): boolean {
    if (this.length + count > this.maxout || this.at + count > this.input.length) return false;
    this.reserve(count);
    this.output.set(this.input.subarray(this.at, this.at + count), this.length);
    [this.at, this.length] = [this.at + count, this.length + count];
    return true;
  }

  /** `fastlz_memmove` copies byte by byte, so a match may repeat the bytes it writes. */
  copyMatch(back: number, count: number): boolean {
    const from = this.length - back;
    if (this.length + count > this.maxout || from < 0) return false;
    this.reserve(count);
    for (let i = 0; i < count; i++) this.output[this.length++] = this.output[from + i]!;
    return true;
  }
}

/** `fastlz_decompress` (fastlz.c:574): the level is the top three bits of the first byte. */
export function fastLzDecompress(input: Uint8Array, maxout: number): FastLzOutput {
  const level = (input[0]! >> 5) + 1;
  if (level === 1) return fastLz1Decompress(input, maxout);
  if (level === 2) return fastLz2Decompress(input, maxout);
  return { written: new Uint8Array(0), isComplete: false };
}

/** `fastlz1_decompress` (fastlz.c:280). */
function fastLz1Decompress(input: Uint8Array, maxout: number): FastLzOutput {
  const decoder = new Decoder(input, maxout);
  const bound = input.length - 2;
  let control = decoder.next() & 31;
  for (;;) {
    if (control >= 32) {
      let length = (control >> 5) - 1;
      const offset = (control & 31) << 8;
      if (length === 6) {
        if (decoder.position > bound) return decoder.result(false);
        length += decoder.next();
      }
      const back = offset + 1 + decoder.next();
      if (!decoder.copyMatch(back, length + 3)) return decoder.result(false);
    } else if (!decoder.copyLiteral(control + 1)) return decoder.result(false);
    if (decoder.position > bound) return decoder.result(true);
    control = decoder.next();
  }
}

/** `fastlz2_decompress` (fastlz.c:512): a match may carry a 16-bit distance past `MAX_L2_DISTANCE`. */
function fastLz2Decompress(input: Uint8Array, maxout: number): FastLzOutput {
  const decoder = new Decoder(input, maxout);
  const bound = input.length - 2;
  let control = decoder.next() & 31;
  for (;;) {
    if (control >= 32) {
      let length = (control >> 5) - 1;
      let offset = (control & 31) << 8;
      if (length === 6) {
        let code;
        do {
          if (decoder.position > bound) return decoder.result(false);
          code = decoder.next();
          length += code;
        } while (code === 255);
      }
      const code = decoder.next();
      let back = offset + 1 + code;
      if (code === 255 && offset === 31 << 8) {
        if (decoder.position >= bound) return decoder.result(false);
        offset = decoder.next() << 8;
        offset += decoder.next();
        back = offset + MAX_L2_DISTANCE + 1;
      }
      if (!decoder.copyMatch(back, length + 3)) return decoder.result(false);
    } else if (!decoder.copyLiteral(control + 1)) return decoder.result(false);
    if (decoder.position >= input.length) return decoder.result(true);
    control = decoder.next();
  }
}
