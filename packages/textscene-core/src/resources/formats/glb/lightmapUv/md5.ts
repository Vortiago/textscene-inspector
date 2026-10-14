/**
 * MD5 (RFC 1321) over a message given in chunks, as Godot's `CryptoCore::MD5Context` hashes an
 * unwrap input in four updates. Web Crypto offers no MD5, so the previewer carries its own.
 */

/** `T[i]`: the integer part of `2^32 * |sin(i + 1)|`. */
const SINE_TABLE = Int32Array.from({ length: 64 }, (_, i) => Math.floor(2 ** 32 * Math.abs(Math.sin(i + 1))));

/** The left rotation of each step, four per round. */
const SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

const BLOCK_BYTES = 64;

/** The digest of the chunks' concatenation, as lowercase hex. */
export function md5Hex(chunks: readonly Uint8Array[]): string {
  const state = new Int32Array([0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476]);
  const block = new Uint8Array(BLOCK_BYTES);
  const words = new DataView(block.buffer);
  let filled = 0;
  let length = 0;

  const absorb = (bytes: Uint8Array): void => {
    for (let read = 0; read < bytes.length;) {
      const taken = Math.min(BLOCK_BYTES - filled, bytes.length - read);
      block.set(bytes.subarray(read, read + taken), filled);
      filled += taken;
      read += taken;
      if (filled === BLOCK_BYTES) {
        compress(state, words);
        filled = 0;
      }
    }
  };

  for (const chunk of chunks) {
    absorb(chunk);
    length += chunk.length;
  }
  absorb(padding(length, filled));
  return hexWords(state);
}

/** The `0x80` byte, the zeros and the 64-bit little-endian bit length that close the message. */
function padding(length: number, filled: number): Uint8Array {
  const zeros = (BLOCK_BYTES + 55 - filled) % BLOCK_BYTES;
  const tail = new Uint8Array(1 + zeros + 8);
  tail[0] = 0x80;
  const bits = new DataView(tail.buffer, 1 + zeros);
  bits.setUint32(0, (length * 8) >>> 0, true);
  bits.setUint32(4, Math.floor(length / 2 ** 29), true);
  return tail;
}

function compress(state: Int32Array, words: DataView): void {
  let [a, b, c, d] = state as unknown as [number, number, number, number];
  for (let i = 0; i < 64; i++) {
    const round = i >> 4;
    let mixed: number;
    let word: number;
    if (round === 0) {
      mixed = (b & c) | (~b & d);
      word = i;
    } else if (round === 1) {
      mixed = (d & b) | (~d & c);
      word = (5 * i + 1) % 16;
    } else if (round === 2) {
      mixed = b ^ c ^ d;
      word = (3 * i + 5) % 16;
    } else {
      mixed = c ^ (b | ~d);
      word = (7 * i) % 16;
    }
    const sum = (a + mixed + SINE_TABLE[i]! + words.getInt32(word * 4, true)) | 0;
    const shift = SHIFTS[round * 4 + (i % 4)]!;
    a = d;
    d = c;
    c = b;
    b = (b + ((sum << shift) | (sum >>> (32 - shift)))) | 0;
  }
  state[0] = (state[0]! + a) | 0;
  state[1] = (state[1]! + b) | 0;
  state[2] = (state[2]! + c) | 0;
  state[3] = (state[3]! + d) | 0;
}

function hexWords(state: Int32Array): string {
  const bytes = new DataView(new ArrayBuffer(16));
  state.forEach((word, i) => bytes.setInt32(i * 4, word, true));
  return hexBytes(new Uint8Array(bytes.buffer));
}

/** Bytes as lowercase hex, two digits each. */
export function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
