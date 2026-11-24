import { describe, expect, it } from 'vitest';
import { anyComponentZero, COMPONENT_VECTORS, componentsEqual, VECTOR_ORDER } from './componentVectors.js';

const VECTOR3 = COMPONENT_VECTORS.VECTOR3!;

describe('VECTOR_ORDER', () => {
  it('orders by the first component that differs', () => {
    expect(VECTOR_ORDER.OP_LESS(VECTOR3, { x: 1, y: 9, z: 9 }, { x: 2, y: 0, z: 0 })).toBe(true);
  });

  it('holds <= on equal vectors', () => {
    const v = { x: 1, y: 2, z: 3 };
    expect([VECTOR_ORDER.OP_LESS_EQUAL(VECTOR3, v, v), VECTOR_ORDER.OP_LESS(VECTOR3, v, v)]).toEqual([
      true,
      false,
    ]);
  });

  it('is false for a NaN component, as the C++ operator is', () => {
    expect(VECTOR_ORDER.OP_LESS(VECTOR3, { x: Number.NaN, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(false);
  });
});

describe('componentsEqual and anyComponentZero', () => {
  it('never equals a NaN component', () => {
    const v = { x: Number.NaN, y: 0, z: 0 };
    expect(componentsEqual(VECTOR3, v, v)).toBe(false);
  });

  it('finds a zero component', () => {
    expect(anyComponentZero(VECTOR3, { x: 1, y: 0, z: 1 })).toBe(true);
  });
});
