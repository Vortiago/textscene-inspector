import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant.js';
import {
  boundMethods,
  componentsOf,
  each2,
  firstMaximumIndex,
  lastMinimumIndex,
  vectorOf,
} from './vectorPorts.js';

describe('componentsOf and vectorOf', () => {
  it('read and write the axes of a vector in order', () => {
    const vector = vectorOf('VECTOR4', [1, 2, 3, 4]);

    expect(vector).toEqual({ type: 'VECTOR4', value: { x: 1, y: 2, z: 3, w: 4 } });
    expect(componentsOf(vector)).toEqual([1, 2, 3, 4]);
  });

  it('builds the same value as the variant constructor', () => {
    expect(vectorOf('VECTOR2', [1, 2])).toEqual(variant('VECTOR2', { x: 1, y: 2 }));
  });
});

describe('each2', () => {
  it('pairs the components of two vectors by axis', () => {
    expect(each2([1, 2], [10, 20], (p, q) => p + q)).toEqual([11, 22]);
  });
});

describe('lastMinimumIndex', () => {
  it('gives the later axis on a tie', () => {
    expect(lastMinimumIndex([1, 0, 0])).toBe(2);
  });

  it('lets a NaN lose every comparison', () => {
    expect(lastMinimumIndex([NaN, 5, 7])).toBe(0);
    expect(lastMinimumIndex([5, NaN, 7])).toBe(0);
  });
});

describe('firstMaximumIndex', () => {
  it('gives the earlier axis on a tie', () => {
    expect(firstMaximumIndex([0, 1, 1])).toBe(1);
  });

  it('lets a NaN lose every comparison', () => {
    expect(firstMaximumIndex([5, NaN, 7])).toBe(2);
  });
});

describe('boundMethods', () => {
  const methods = boundMethods('VECTOR2I', 'int32_t', 'i');
  const base = vectorOf('VECTOR2I', [3, -4]);

  it('names the scalar forms with the suffix', () => {
    expect(Object.keys(methods).sort()).toEqual(['clamp', 'clampi', 'max', 'maxi', 'min', 'mini']);
  });

  it('bounds each axis by the other vector', () => {
    expect(methods.min!.run(base, [vectorOf('VECTOR2I', [1, 1])])).toEqual(vectorOf('VECTOR2I', [1, -4]));
  });

  it('clamps each axis between two scalars', () => {
    expect(methods.clampi!.run(base, [0, 2])).toEqual(vectorOf('VECTOR2I', [2, 0]));
  });

  it('declares the vector type for a vector parameter and the scalar for a scalar', () => {
    expect(methods.clamp!.parameters).toEqual(['VECTOR2I', 'VECTOR2I']);
    expect(methods.maxi!.parameters).toEqual(['int32_t']);
  });
});
