import { describe, expect, it } from 'vitest';
import { packedElements } from './packedElements.js';
import { int, real as float, variant } from './variant.js';

describe('packedElements', () => {
  it('gives the ints of a packed array as INT', () => {
    expect(packedElements(variant('PACKED_INT32_ARRAY', [1, -2]))).toEqual([int(1n), int(-2n)]);
  });

  it('gives the floats of a packed array as FLOAT', () => {
    expect(packedElements(variant('PACKED_FLOAT64_ARRAY', [0.5]))).toEqual([float(0.5)]);
  });

  it('gives no element for an empty packed array', () => {
    expect(packedElements(variant('PACKED_STRING_ARRAY', []))).toEqual([]);
  });
});
