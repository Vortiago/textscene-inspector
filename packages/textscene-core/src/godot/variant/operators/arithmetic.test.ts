import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant.js';
import { bitwise, divideNonZero, moduloNonZero, negate, power, shift, xform } from './arithmetic.js';

const INT64_MIN = -(2n ** 63n);
const int = (value: bigint) => variant('INT', value);

// Each expected answer is Godot 4.6.3's operator on the same values.
describe('arithmetic', () => {
  it('shifts an int past bit 63 to INT64_MIN', () => {
    expect(shift('left', 2n ** 62n, 1n)).toEqual(int(INT64_MIN));
  });

  it('refuses a shift of a negative int', () => {
    expect(shift('left', -1n, 1n)).toBeUndefined();
  });

  it('casts 2 ** 63 to INT64_MIN as x86-64 does', () => {
    expect(power('INT', int(2n), int(63n))).toEqual(int(INT64_MIN));
  });

  it('truncates an int division towards zero', () => {
    expect(divideNonZero(int(-7n), int(2n))).toEqual(int(-3n));
  });

  it('refuses a division by a zero component of an int vector', () => {
    const vector = variant('VECTOR2I', { x: 1, y: 1 });
    expect(divideNonZero(vector, variant('VECTOR2I', { x: 1, y: 0 }))).toBeUndefined();
  });

  it('takes the sign of the dividend in an int vector remainder', () => {
    const remainder = moduloNonZero(
      variant('VECTOR3I', { x: 7, y: -7, z: 0 }),
      variant('VECTOR3I', { x: 3, y: 3, z: 1 })
    );
    expect(remainder).toEqual(variant('VECTOR3I', { x: 1, y: -1, z: 0 }));
  });

  it('negates a colour to its inverse', () => {
    expect(negate(variant('COLOR', { r: 0.25, g: 0, b: 1, a: 1 }))).toEqual(
      variant('COLOR', { r: 0.75, g: 1, b: 0, a: 0 })
    );
  });

  it('wraps the negation of INT64_MIN', () => {
    expect(negate(int(INT64_MIN))).toEqual(int(INT64_MIN));
  });

  it('xors two ints', () => {
    expect(bitwise('xor', 5n, 3n)).toEqual(int(6n));
  });

  it('throws on xform with a type that is no transform', () => {
    expect(() => xform(int(1n), variant('VECTOR2', { x: 0, y: 0 }))).toThrow('expected a transform, got INT');
  });
});
