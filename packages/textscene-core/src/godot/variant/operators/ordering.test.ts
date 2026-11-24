import { describe, expect, it } from 'vitest';
import { variant, type Variant } from '../value/variant.js';
import { compare, UnportableComparison } from './ordering.js';

const int = (value: bigint) => variant('INT', value);
const name = (value: string) => variant('STRING_NAME', value);
const array = (...elements: Variant[]) => variant('ARRAY', elements);
// Variant::operator< of elements of one type, which every case here holds.
const isVariantLess = (a: Variant, b: Variant): boolean => compare('OP_LESS', a, b, isVariantLess);
const less = isVariantLess;

describe('compare of numbers', () => {
  it('orders two ints', () => {
    expect([less(int(1n), int(2n)), less(int(2n), int(1n))]).toEqual([true, false]);
  });

  it('orders an int against a float as doubles', () => {
    expect(less(int(1n), variant('FLOAT', 1.5))).toBe(true);
  });

  it('holds each comparison on equal values', () => {
    const results = (['OP_LESS', 'OP_LESS_EQUAL', 'OP_GREATER', 'OP_GREATER_EQUAL'] as const).map((op) =>
      compare(op, int(3n), int(3n), isVariantLess)
    );
    expect(results).toEqual([false, true, false, true]);
  });

  it('orders false before true', () => {
    expect(less(variant('BOOL', false), variant('BOOL', true))).toBe(true);
  });
});

describe('compare of strings', () => {
  it('orders by the text', () => {
    expect(less(variant('STRING', 'a'), variant('STRING', 'b'))).toBe(true);
  });

  it('defines <= from <', () => {
    expect(compare('OP_LESS_EQUAL', variant('STRING', 'b'), variant('STRING', 'b'), isVariantLess)).toBe(
      true
    );
  });
});

describe('compare of StringNames', () => {
  it('orders the empty name first, as its address is null', () => {
    expect(less(name(''), name('a'))).toBe(true);
  });

  it('holds a name not less than itself', () => {
    expect(less(name('a'), name('a'))).toBe(false);
  });

  it('throws on two other names, which Godot orders by address', () => {
    expect(() => less(name('a'), name('b'))).toThrow(UnportableComparison);
  });
});

describe('compare of arrays', () => {
  it('orders by the first element that differs', () => {
    expect(less(array(int(2n)), array(int(1n), int(5n)))).toBe(false);
  });

  it('orders a shorter array with the same start first', () => {
    expect(less(array(int(1n)), array(int(1n), int(2n)))).toBe(true);
  });
});

describe('compare of vectors', () => {
  it('orders by the first component that differs', () => {
    const vector = (x: number, y: number) => variant('VECTOR2', { x, y });
    expect([less(vector(1, 5), vector(2, 0)), less(vector(1, 5), vector(1, 4))]).toEqual([true, false]);
  });
});
