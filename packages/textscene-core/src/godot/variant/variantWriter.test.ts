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

  it('writes the non-finite values as inf, -inf and nan', () => {
    expect([Infinity, -Infinity, NaN].map(componentLiteral)).toEqual(['inf', '-inf', 'nan']);
  });
});

describe('floatLiteral', () => {
  it('appends .0 to an integral float, so it stays a float literal', () => {
    expect(floatLiteral(1)).toBe('1.0');
  });

  it('appends nothing to a spelling with a point, an exponent or no digits', () => {
    expect([0.5, 1e-7, Infinity].map(floatLiteral)).toEqual(['0.5', '1e-7', 'inf']);
  });
});
