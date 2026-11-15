import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant.js';
import { evaluateOperator, isVariantLess } from './evaluate.js';

// Each expected answer is Godot 4.6.3's operator on the same values.
describe('evaluateOperator', () => {
  it('equals two equal vectors', () => {
    const v = variant('VECTOR2', { x: 1, y: 2 });
    expect(evaluateOperator('OP_EQUAL', v, v)).toEqual(variant('BOOL', true));
  });

  it('adds two colours componentwise', () => {
    expect(
      evaluateOperator(
        'OP_ADD',
        variant('COLOR', { r: 1, g: 0, b: 0, a: 1 }),
        variant('COLOR', { r: 0, g: 1, b: 0, a: 1 })
      )
    ).toEqual(variant('COLOR', { r: 1, g: 1, b: 0, a: 2 }));
  });

  it('has no result for a pair with no registration', () => {
    expect(evaluateOperator('OP_ADD', variant('STRING', 'a'), variant('INT', 1n))).toBeUndefined();
  });

  it('has no result for an int divided by zero', () => {
    expect(evaluateOperator('OP_DIVIDE', variant('INT', 1n), variant('INT', 0n))).toBeUndefined();
  });
});

describe('isVariantLess', () => {
  it('orders by type first', () => {
    expect(isVariantLess(variant('STRING', 'a'), variant('INT', 9n))).toBe(false);
  });

  it('orders two ints by value', () => {
    expect(isVariantLess(variant('INT', 1n), variant('INT', 2n))).toBe(true);
  });
});
