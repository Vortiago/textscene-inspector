import { describe, expect, it } from 'vitest';
import { packedVectors, UNIFORM_SHAPES } from './packing.mjs';

const { FLOAT, FLOAT_VEC2, FLOAT_VEC3, FLOAT_VEC4, FLOAT_MAT3, FLOAT_MAT4 } = UNIFORM_SHAPES;

describe('packedVectors', () => {
  it('gives a mat4 four vectors and a vec4 one', () => {
    expect(
      packedVectors([
        { type: FLOAT_MAT4, size: 2 },
        { type: FLOAT_VEC4, size: 3 },
      ])
    ).toBe(11);
  });

  it('puts a float in the fourth column of a vec3 row', () => {
    expect(
      packedVectors([
        { type: FLOAT_VEC3, size: 1 },
        { type: FLOAT, size: 1 },
      ])
    ).toBe(1);
  });

  it('puts two vec2 side by side in one row', () => {
    expect(
      packedVectors([
        { type: FLOAT_VEC2, size: 1 },
        { type: FLOAT_VEC2, size: 1 },
      ])
    ).toBe(1);
  });

  it('keeps an array in one column span, an element per row (edge case)', () => {
    expect(packedVectors([{ type: FLOAT_VEC2, size: 2 }])).toBe(2);
  });

  it('keeps a vec2 out of the column a vec3 leaves free (edge case)', () => {
    expect(
      packedVectors([
        { type: FLOAT_VEC3, size: 2 },
        { type: FLOAT_VEC2, size: 1 },
      ])
    ).toBe(3);
  });

  it('packs five floats into two rows', () => {
    expect(packedVectors(Array.from({ length: 5 }, () => ({ type: FLOAT, size: 1 })))).toBe(2);
  });

  it('gives a mat3 three rows of three columns', () => {
    expect(
      packedVectors([
        { type: FLOAT_MAT3, size: 1 },
        { type: FLOAT, size: 3 },
      ])
    ).toBe(3);
  });

  it('needs no vector for no uniform (edge case)', () => {
    expect(packedVectors([])).toBe(0);
  });

  it('refuses a type it has no shape for (error case)', () => {
    expect(() => packedVectors([{ type: 0x8b5e, size: 1 }])).toThrow(
      'no packing shape for uniform type 0x8b5e'
    );
  });
});
