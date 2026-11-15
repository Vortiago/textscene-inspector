import { describe, expect, it } from 'vitest';
import { variant } from '../value/variant.js';
import { evaluateOperator } from './evaluate.js';

// Each expected answer is Godot 4.6.3's operator on the same values.
describe('evaluateOperator', () => {
  it('equals two equal vectors', () => {
    const v = variant('VECTOR2', { x: 1, y: 2 });
    expect(evaluateOperator('OP_EQUAL', v, v)).toEqual({ value: variant('BOOL', true), isValid: true });
  });

  it('adds two colours componentwise', () => {
    expect(
      evaluateOperator(
        'OP_ADD',
        variant('COLOR', { r: 1, g: 0, b: 0, a: 1 }),
        variant('COLOR', { r: 0, g: 1, b: 0, a: 1 })
      )
    ).toEqual({ value: variant('COLOR', { r: 1, g: 1, b: 0, a: 2 }), isValid: true });
  });

  it('orders the elements of two arrays with Variant::operator<, which orders by type first', () => {
    const left = variant('ARRAY', [variant('INT', 9n)]);
    const right = variant('ARRAY', [variant('STRING', 'a')]);
    expect(evaluateOperator('OP_LESS', left, right)).toEqual({ value: variant('BOOL', true), isValid: true });
  });

  it('leaves Nil for a pair with no registration', () => {
    expect(evaluateOperator('OP_ADD', variant('STRING', 'a'), variant('INT', 1n))).toEqual({
      value: variant('NIL', null),
      isValid: false,
    });
  });

  it('leaves the error text for an int divided by zero', () => {
    expect(evaluateOperator('OP_DIVIDE', variant('INT', 1n), variant('INT', 0n))).toEqual({
      value: variant('STRING', 'Division by zero error'),
      isValid: false,
    });
  });

  it('leaves the sprintf error text for a format with too few values', () => {
    expect(evaluateOperator('OP_MODULE', variant('STRING', '%d %d'), variant('INT', 1n))).toEqual({
      value: variant('STRING', 'not enough arguments for format string'),
      isValid: false,
    });
  });
});
