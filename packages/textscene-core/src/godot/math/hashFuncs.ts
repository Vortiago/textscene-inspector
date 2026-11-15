/**
 * Godot's hash of an `Array` of ints (`core/templates/hashfuncs.h`, `core/variant/array.cpp:195-208`),
 * the seed a tile layer draws a scene tile's placeholder colour from.
 */

import { VARIANT_TYPE } from '../variant/variantType.js';

const UINT64_MASK = 0xffffffffffffffffn;

/** `hash_murmur3_one_32` (`hashfuncs.h:112-122`): one word folded into `seed`. */
function murmur3One32(word: number, seed: number): number {
  let mixed = Math.imul(word, 0xcc9e2d51);
  mixed = (mixed << 15) | (mixed >>> 17);
  mixed = Math.imul(mixed, 0x1b873593);
  let mixedSeed = seed ^ mixed;
  mixedSeed = (mixedSeed << 13) | (mixedSeed >>> 19);
  return (Math.imul(mixedSeed, 5) + 0xe6546b64) >>> 0;
}

/** `hash_fmix32` (`hashfuncs.h:144-152`). */
function fmix32(hash: number): number {
  let h = hash ^ (hash >>> 16);
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** `hash_one_uint64` (`hashfuncs.h:87-96`): the `Variant::hash` of an INT, which sign-extends to 64 bits. */
function hashOneUint64(int: number): number {
  let v = BigInt.asUintN(64, BigInt(int));
  v = (~v + (v << 18n)) & UINT64_MASK;
  v ^= v >> 31n;
  v = (v * 21n) & UINT64_MASK;
  v ^= v >> 11n;
  v = (v + (v << 6n)) & UINT64_MASK;
  v ^= v >> 22n;
  return Number(v & 0xffffffffn);
}

/** `Array::hash` of an array of INT Variants, as `[1, 2].hash()` returns it. */
export function hashIntArray(ints: readonly number[]): number {
  let h = murmur3One32(VARIANT_TYPE.ARRAY, 0x7f07c65);
  for (const int of ints) h = murmur3One32(hashOneUint64(int), h);
  return fmix32(h);
}
