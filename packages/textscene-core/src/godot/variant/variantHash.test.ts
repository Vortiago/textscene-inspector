import { describe, expect, it } from 'vitest';
import { nodePathParts } from '../string/nodePathParts';
import { variant, type Variant } from './value/variant';
import { variantHash } from './variantHash';

const int = (value: number) => variant('INT', BigInt(value));
const nodePath = (text: string) => variant('NODE_PATH', nodePathParts(text)!);
const nested = (depth: number): Variant => (depth === 0 ? int(1) : variant('ARRAY', [nested(depth - 1)]));

describe('variantHash', () => {
  // Printed by Godot 4.6.3: `print([0, 1].hash())` and the others.
  it.each([
    [[0, 1], 1996449155],
    [[3, 7], 2288432370],
    [[2, 536870913], 563863509],
    [[5, -1], 935429685],
  ])('hashes the array of ints %j as Godot does', (ints, expected) => {
    expect(variantHash(variant('ARRAY', ints.map(int)))).toBe(expected);
  });

  it('hashes an array nested past MAX_RECURSION as the array that holds 0 there', () => {
    expect(variantHash(nested(102))).toBe(1691475427);
  });

  it('hashes a relative NodePath as the inverse of the absolute one', () => {
    const absolute = variantHash(nodePath('/a:b'));
    expect(variantHash(nodePath('a:b'))).toBe(~absolute >>> 0);
  });

  it('hashes one NodePath name that holds a slash as the two names of its text', () => {
    const oneName = variant('NODE_PATH', { absolute: false, names: ['a/b'], subnames: [] });
    expect(variantHash(oneName)).toBe(variantHash(nodePath('a/b')));
  });

  it('hashes an empty PackedInt32Array as one 64-bit zero', () => {
    expect(variantHash(variant('PACKED_INT32_ARRAY', []))).toBe(546098158);
  });
});
