import { describe, expect, it } from 'vitest';
import { typedArray } from '../construct/typedContainer';
import { variant, type Variant } from '../value/variant';
import { variantToBytes } from './encodeVariant';

const int = (value: bigint) => variant('INT', value);

// Each byte list is what Godot 4.6.3's var_to_bytes writes for the value.
describe('variantToBytes', () => {
  it('writes an int that fits 32 bits in 4 bytes, and a wider one with the 64-bit flag', () => {
    expect(variantToBytes(int(-1n), false)).toEqual([2, 0, 0, 0, 255, 255, 255, 255]);
    expect(variantToBytes(int(2n ** 31n), false)).toEqual([2, 0, 1, 0, 0, 0, 0, 128, 0, 0, 0, 0]);
  });

  it('writes a typed array of objects by class, or as EncodedObjectAsID without objects', () => {
    const nodes = typedArray([], { type: 24, className: 'Node' });
    expect(variantToBytes(nodes, true)).toEqual([28, 0, 2, 0, 4, 0, 0, 0, 78, 111, 100, 101, 0, 0, 0, 0]);
    expect(variantToBytes(nodes, false).slice(4, 8)).toEqual([17, 0, 0, 0]);
  });

  it('writes nothing for a container nested past MAX_RECURSION_DEPTH (edge case)', () => {
    let nested: Variant = variant('ARRAY', []);
    for (let depth = 0; depth < 1025; depth++) nested = variant('ARRAY', [nested]);
    expect(variantToBytes(nested, false)).toEqual([]);
  });
});
