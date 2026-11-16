/**
 * MD5 (RFC 1321) over a message given in chunks, as Godot's `CryptoCore::MD5Context` hashes an
 * unwrap input in four updates. Web Crypto offers no MD5, so the previewer carries its own.
 */

import { hashBlocks, hexBytes, rotateLeft, stateBytes } from './blockHash.js';

/** `T[i]`: the integer part of `2^32 * |sin(i + 1)|`. */
const SINE_TABLE = Int32Array.from({ length: 64 }, (_, i) => Math.floor(2 ** 32 * Math.abs(Math.sin(i + 1))));

/** The left rotation of each step, four per round. */
const SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

/** The digest of the chunks' concatenation. */
export function md5(chunks: readonly Uint8Array[]): Uint8Array {
  const state = new Int32Array([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476]);
  hashBlocks(chunks, (block) => compress(state, block), true);
  return stateBytes(state, true);
}

/** The digest of the chunks' concatenation, as lowercase hex. */
export const md5Hex = (chunks: readonly Uint8Array[]): string => hexBytes(md5(chunks));

/** The message word each step reads, by round: `i`, `5i + 1`, `3i + 5` and `7i`, modulo 16. */
const STEP_WORD = Int32Array.from({ length: 64 }, (_, i) => [i, 5 * i + 1, 3 * i + 5, 7 * i][i >> 4]! % 16);

/** The left rotation of each step. */
const STEP_SHIFT = Int32Array.from({ length: 64 }, (_, i) => SHIFTS[(i >> 4) * 4 + (i % 4)]!);

/** The block's sixteen little-endian words, read once per block. */
const blockWords = new Int32Array(16);

function compress(state: Int32Array, words: DataView): void {
  for (let word = 0; word < 16; word++) blockWords[word] = words.getInt32(word * 4, true);
  let a = state[0]!;
  let b = state[1]!;
  let c = state[2]!;
  let d = state[3]!;
  for (let i = 0; i < 64; i++) {
    const round = i >> 4;
    let mixed: number;
    if (round === 0) mixed = (b & c) | (~b & d);
    else if (round === 1) mixed = (d & b) | (~d & c);
    else if (round === 2) mixed = b ^ c ^ d;
    else mixed = c ^ (b | ~d);
    const sum = (a + mixed + SINE_TABLE[i]! + blockWords[STEP_WORD[i]!]!) | 0;
    const shift = STEP_SHIFT[i]!;
    a = d;
    d = c;
    c = b;
    b = (b + rotateLeft(sum, shift)) | 0;
  }
  state[0] = (state[0]! + a) | 0;
  state[1] = (state[1]! + b) | 0;
  state[2] = (state[2]! + c) | 0;
  state[3] = (state[3]! + d) | 0;
}
