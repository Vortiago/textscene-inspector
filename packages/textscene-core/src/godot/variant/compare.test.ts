import { describe, expect, it } from 'vitest';
import { booleanize, cppEqual, findEntry, isSameKey, isZero, setEntry } from './compare.js';
import { variant, type DictionaryEntry } from './value/variant.js';

const int = (value: bigint) => variant('INT', value);
const float = (value: number) => variant('FLOAT', value);
const text = (value: string) => variant('STRING', value);
const name = (value: string) => variant('STRING_NAME', value);
const vector2 = (x: number, y: number) => variant('VECTOR2', { x, y });

describe('cppEqual', () => {
  it('equals an int and a float of one value', () => {
    expect(cppEqual(int(2n), float(2))).toBe(true);
  });

  it('tells two strings apart', () => {
    expect(cppEqual(text('a'), text('b'))).toBe(false);
  });

  it('never equals a vector holding NaN to itself', () => {
    const v = vector2(Number.NaN, 0);
    expect(cppEqual(v, v)).toBe(false);
  });

  it('equals two arrays element by element', () => {
    expect(cppEqual(variant('ARRAY', [int(1n), text('a')]), variant('ARRAY', [int(1n), text('a')]))).toBe(
      true
    );
  });

  it('equals two dictionaries in another key order', () => {
    const a: DictionaryEntry[] = [
      { key: text('x'), value: int(1n) },
      { key: text('y'), value: int(2n) },
    ];
    expect(cppEqual(variant('DICTIONARY', a), variant('DICTIONARY', [...a].reverse()))).toBe(true);
  });
});

describe('the NaN rule of hash_compare', () => {
  it('matches a NaN key to a NaN key', () => {
    expect(isSameKey(float(Number.NaN), float(Number.NaN))).toBe(true);
  });

  it('matches NaN lanes of a vector key', () => {
    expect(isSameKey(vector2(Number.NaN, 1), vector2(Number.NaN, 1))).toBe(true);
  });

  it('never equals arrays that hold NaN, as recursive_equal is not semantic', () => {
    const array = variant('ARRAY', [float(Number.NaN)]);
    expect(cppEqual(array, array)).toBe(false);
  });
});

describe('isSameKey', () => {
  it('matches a String to the StringName of its text', () => {
    expect(isSameKey(text('a'), name('a'))).toBe(true);
  });

  it('does not match an int to a float key', () => {
    expect(isSameKey(int(1n), float(1))).toBe(false);
  });
});

describe('setEntry', () => {
  it('keeps the place of an existing key', () => {
    const entries = [
      { key: text('a'), value: int(1n) },
      { key: text('b'), value: int(2n) },
    ];
    setEntry(entries, name('a'), int(9n));
    expect(entries).toEqual([
      { key: text('a'), value: int(9n) },
      { key: text('b'), value: int(2n) },
    ]);
  });

  it('adds a new key at the end', () => {
    const entries: DictionaryEntry[] = [];
    setEntry(entries, text('a'), int(1n));
    expect(entries).toEqual([{ key: text('a'), value: int(1n) }]);
  });

  it('finds no entry for a missing key', () => {
    expect(findEntry([{ key: text('a'), value: int(1n) }], text('b'))).toBeUndefined();
  });
});

describe('isZero and booleanize', () => {
  it('is zero for an empty array', () => {
    expect(isZero(variant('ARRAY', []))).toBe(true);
  });

  it('is zero for the default transform', () => {
    expect(isZero(variant('TRANSFORM2D', { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }))).toBe(true);
  });

  it('is true for a non-empty string', () => {
    expect(booleanize(text('0'))).toBe(true);
  });

  it('is false for -0.0', () => {
    expect(booleanize(float(-0))).toBe(false);
  });
});
