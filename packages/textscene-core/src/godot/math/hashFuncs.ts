export const HASH_MURMUR3_SEED = 0x7f07c65;

const UINT64_MASK = 0xffffffffffffffffn;

// One buffer each, reused: a hash reads a value's bits once and keeps none of them.
const FLOAT_BITS = new DataView(new ArrayBuffer(8));

const rotl32 = (word: number, shift: number) => (word << shift) | (word >>> (32 - shift));

function mixedBlock(block: number): number {
  return Math.imul(rotl32(Math.imul(block, 0xcc9e2d51), 15), 0x1b873593);
}

/** `hash_murmur3_one_32` (hashfuncs.h:112). */
export function murmur3One32(word: number, seed = HASH_MURMUR3_SEED): number {
  const mixedSeed = rotl32(seed ^ mixedBlock(word), 13);
  return (Math.imul(mixedSeed, 5) + 0xe6546b64) >>> 0;
}

/** `hash_murmur3_one_64` (hashfuncs.h:124). */
export function murmur3One64(word: bigint, seed = HASH_MURMUR3_SEED): number {
  const bits = BigInt.asUintN(64, word);
  return murmur3One32(Number(bits >> 32n), murmur3One32(Number(bits & 0xffffffffn), seed));
}

/** `hash_fmix32` (hashfuncs.h:144). */
export function fmix32(hash: number): number {
  let h = hash ^ (hash >>> 16);
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** `hash_one_uint64` (hashfuncs.h:87), of the two's complement bits of `int`. */
export function hashOneUint64(int: bigint): number {
  let v = BigInt.asUintN(64, int);
  v = (~v + (v << 18n)) & UINT64_MASK;
  v ^= v >> 31n;
  v = (v * 21n) & UINT64_MASK;
  v ^= v >> 11n;
  v = (v + (v << 6n)) & UINT64_MASK;
  v ^= v >> 22n;
  return Number(v & 0xffffffffn);
}

// The bits of `Math::NaN`, a quiet NaN with its sign clear, in a float and in a double.
const FLOAT_NAN_BITS = 0x7fc00000;
const DOUBLE_NAN_BITS = 0x7ff8000000000000n;

/** `hash_murmur3_one_float` (hashfuncs.cpp:32), of `value` rounded to a float. */
export function murmur3OneFloat(value: number, seed = HASH_MURMUR3_SEED): number {
  if (Number.isNaN(value)) return murmur3One32(FLOAT_NAN_BITS, seed);
  FLOAT_BITS.setFloat32(0, value === 0 ? 0 : value);
  return murmur3One32(FLOAT_BITS.getUint32(0), seed);
}

/** `hash_murmur3_one_double` (hashfuncs.cpp:49). */
export function murmur3OneDouble(value: number, seed = HASH_MURMUR3_SEED): number {
  if (Number.isNaN(value)) return murmur3One64(DOUBLE_NAN_BITS, seed);
  FLOAT_BITS.setFloat64(0, value === 0 ? 0 : value);
  return murmur3One64(FLOAT_BITS.getBigUint64(0), seed);
}

/** `hash_murmur3_buffer` (hashfuncs.cpp:66), reading each 4-byte block little-endian. */
export function murmur3Buffer(bytes: Uint8Array, seed = HASH_MURMUR3_SEED): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tailStart = bytes.length & ~3;
  let h = seed;
  for (let offset = 0; offset < tailStart; offset += 4) {
    h = rotl32(h ^ mixedBlock(view.getUint32(offset, true)), 13);
    h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
  }
  let tail = 0;
  for (let index = bytes.length - 1; index >= tailStart; index--) tail = (tail << 8) | bytes[index]!;
  if (bytes.length > tailStart) h ^= mixedBlock(tail);
  return fmix32(h ^ bytes.length);
}

/** `String::hash` (ustring.cpp:2758): djb2 with an add, over the code points up to the first NUL. */
export function stringHash(text: string): number {
  let hash = 5381;
  for (const character of text) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint === 0) break;
    hash = (Math.imul(hash, 33) + codePoint) >>> 0;
  }
  return hash;
}
