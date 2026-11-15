import { describe, expect, it } from 'vitest';
import { InvalidOperands } from './invalidOperands.js';
import { variant, type Variant } from '../value/variant.js';
import {
  addArrays,
  appendPacked,
  concatenate,
  format,
  isInArray,
  isInDictionary,
  isInPacked,
  isInString,
} from './containers.js';

const int = (value: bigint) => variant('INT', value);
const float = (value: number) => variant('FLOAT', value);
const text = (value: string) => variant('STRING', value);

describe('addArrays', () => {
  it('gives the elements of both in order', () => {
    expect(addArrays([int(1n)], [int(2n), text('a')])).toEqual(
      variant('ARRAY', [int(1n), int(2n), text('a')])
    );
  });

  it('gives an empty array for two empty ones', () => {
    expect(addArrays([], [])).toEqual(variant('ARRAY', []));
  });
});

describe('appendPacked', () => {
  it("puts the other array's elements after its own", () => {
    expect(appendPacked(variant('PACKED_INT32_ARRAY', [1]), variant('PACKED_INT32_ARRAY', [2, 3]))).toEqual(
      variant('PACKED_INT32_ARRAY', [1, 2, 3])
    );
  });

  it('keeps an array when the other is empty', () => {
    expect(appendPacked(variant('PACKED_STRING_ARRAY', ['a']), variant('PACKED_STRING_ARRAY', []))).toEqual(
      variant('PACKED_STRING_ARRAY', ['a'])
    );
  });
});

describe('concatenate', () => {
  it('joins two strings', () => {
    expect(concatenate(text('ab'), text('cd'))).toEqual(text('abcd'));
  });
});

describe('format', () => {
  it('reads one value that is not an array', () => {
    expect(format('%d!', int(5n))).toEqual(text('5!'));
  });

  it('reads the values of an array', () => {
    expect(format('%s-%s', variant('ARRAY', [int(1n), text('b')]))).toEqual(text('1-b'));
  });

  it('gives nothing when the values run out', () => {
    expect(format('%d %d', variant('ARRAY', [int(1n)]))).toEqual(
      new InvalidOperands(text('not enough arguments for format string'))
    );
  });
});

describe('isInString', () => {
  it('finds a text inside another', () => {
    expect(isInString('ell', 'hello')).toBe(true);
  });

  it('finds no empty text, as String::find does', () => {
    expect(isInString('', 'hello')).toBe(false);
  });

  it('finds no text that is not there', () => {
    expect(isInString('x', 'hello')).toBe(false);
  });
});

describe('isInArray', () => {
  it('finds an equal element', () => {
    expect(isInArray(int(2n), [int(1n), int(2n)])).toBe(true);
  });

  it('finds a String among StringNames of the same text', () => {
    expect(isInArray(text('a'), [variant('STRING_NAME', 'a')])).toBe(true);
  });

  it('finds nothing in an empty array', () => {
    expect(isInArray(int(1n), [])).toBe(false);
  });
});

describe('isInDictionary', () => {
  const entries = [{ key: text('k'), value: int(1n) }];

  it('finds a key', () => {
    expect(isInDictionary(text('k'), entries)).toBe(true);
  });

  it('does not find a value', () => {
    expect(isInDictionary(int(1n), entries)).toBe(false);
  });
});

describe('isInPacked', () => {
  it('converts a float to the int element type first', () => {
    expect(isInPacked(float(2.9), variant('PACKED_INT32_ARRAY', [2]))).toBe(true);
  });

  it('wraps an int to the 32 bits of the element', () => {
    expect(isInPacked(int(2n ** 32n + 7n), variant('PACKED_INT32_ARRAY', [7]))).toBe(true);
  });

  it('rounds a double to the float of the element', () => {
    expect(isInPacked(float(0.1), variant('PACKED_FLOAT32_ARRAY', [Math.fround(0.1)]))).toBe(true);
  });

  it('compares a vector with each vector element', () => {
    const packed = variant('PACKED_VECTOR2_ARRAY', [{ x: 1, y: 2 }]);
    const found = (value: Variant) => isInPacked(value, packed);
    expect([found(variant('VECTOR2', { x: 1, y: 2 })), found(variant('VECTOR2', { x: 2, y: 1 }))]).toEqual([
      true,
      false,
    ]);
  });
});
