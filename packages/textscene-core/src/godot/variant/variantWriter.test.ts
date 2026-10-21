/** Godot's text spellings of a number, each from `VariantWriter::write` (`variant_parser.cpp:1985-2030`). */

import { describe, expect, it } from 'vitest';
import { componentLiteral, floatLiteral } from './variantWriter';

describe('componentLiteral', () => {
  it('writes zero without its sign', () => {
    expect(componentLiteral(-0)).toBe('0');
  });

  it('writes a value a float32 holds with the fewest digits that read back as it', () => {
    expect(componentLiteral(Math.fround(0.759765625))).toBe('0.7597656');
  });

  it('writes a value no float32 holds with every digit of the double', () => {
    expect(componentLiteral(0.1)).toBe('0.1');
    expect(componentLiteral(1 / 3)).toBe('0.3333333333333333');
  });

  // Each spelling is what Godot 4.6.3's `var_to_str` writes for the value.
  it('writes a value below 1e-4 in scientific notation, with a two-digit exponent', () => {
    expect([1.001358e-5, 1e-5, 1e-7, 1.5e-10, 1e-45].map(Math.fround).map(componentLiteral)).toEqual([
      '1.001358e-05',
      '1e-05',
      '1e-07',
      '1.5e-10',
      '1e-45',
    ]);
  });

  it('writes a value from 1e-4 to below 1e15 in decimal notation (edge case)', () => {
    expect([0.0001, 0.00012345, 1234567890123].map(Math.fround).map(componentLiteral)).toEqual([
      '0.0001',
      '0.00012345',
      '1234568000000',
    ]);
  });

  it('writes a value from 1e15 up in scientific notation, with a signed exponent', () => {
    expect([1e15, 1.5e20, 3.4e38].map(Math.fround).map(componentLiteral)).toEqual([
      '1e+15',
      '1.5e+20',
      '3.4e+38',
    ]);
  });

  it('writes the non-finite values as inf, -inf and nan', () => {
    expect([Infinity, -Infinity, NaN].map(componentLiteral)).toEqual(['inf', '-inf', 'nan']);
  });
});

describe('floatLiteral', () => {
  it('appends .0 to an integral float, so it stays a float literal', () => {
    expect(floatLiteral(1)).toBe('1.0');
  });

  it('appends nothing to a spelling with a point, an exponent or no digits', () => {
    expect([0.5, Math.fround(1e-7), Infinity].map(floatLiteral)).toEqual(['0.5', '1e-07', 'inf']);
  });
});
