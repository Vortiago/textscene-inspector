import { hashBlocks, rotateLeft, stateBytes } from './blockHash.js';

/** The constant of each group of twenty steps. */
const ROUND_CONSTANTS = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc | 0, 0xca62c1d6 | 0];

/** The schedule's eighty words, rewritten for each block. */
const schedule = new Int32Array(80);

function compress(state: Int32Array, block: DataView): void {
  for (let t = 0; t < 16; t++) schedule[t] = block.getInt32(t * 4);
  for (let t = 16; t < 80; t++)
    schedule[t] = rotateLeft(schedule[t - 3]! ^ schedule[t - 8]! ^ schedule[t - 14]! ^ schedule[t - 16]!, 1);
  let [a, b, c, d, e] = state as unknown as [number, number, number, number, number];
  for (let t = 0; t < 80; t++) {
    const group = Math.floor(t / 20);
    let mixed: number;
    if (group === 0) mixed = (b & c) | (~b & d);
    else if (group === 2) mixed = (b & c) | (b & d) | (c & d);
    else mixed = b ^ c ^ d;
    const next = (rotateLeft(a, 5) + mixed + e + ROUND_CONSTANTS[group]! + schedule[t]!) | 0;
    e = d;
    d = c;
    c = rotateLeft(b, 30);
    b = a;
    a = next;
  }
  [a, b, c, d, e].forEach((word, i) => (state[i] = (state[i]! + word) | 0));
}

/** The 20-byte digest of the chunks' concatenation. */
export function sha1(chunks: readonly Uint8Array[]): Uint8Array {
  const state = new Int32Array([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476, 0xc3d2e1f0 | 0]);
  hashBlocks(chunks, (block) => compress(state, block), false);
  return stateBytes(state, false);
}
