/**
 * The slice's THROWING Color reader — the one decoder in the value-decoder family
 * that rejects a malformed literal instead of substituting a fallback, because
 * its callers (the linter's Color validators, the scientific-notation regression
 * guard) need the rejection. `decode.ts` uses the optional reader instead.
 */

import { describe, it, expect } from 'vitest';
import { parseColor } from './parser';

describe('parseColor', () => {
  it('should parse valid Color format', () => {
    const color = parseColor('Color(1, 0, 0, 1)');

    expect(color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('should parse Color with decimal values', () => {
    const color = parseColor('Color(0.545098, 0.270588, 0.0745098, 1)');

    expect(color).toEqual({
      r: 0.545098,
      g: 0.270588,
      b: 0.0745098,
      a: 1,
    });
  });

  it('should parse Color with spaces', () => {
    const color = parseColor('Color( 1 , 0.5 , 0.25 , 0.75 )');

    expect(color).toEqual({ r: 1, g: 0.5, b: 0.25, a: 0.75 });
  });

  it('should parse Color with no spaces', () => {
    const color = parseColor('Color(0.2,0.3,0.4,0.5)');

    expect(color).toEqual({ r: 0.2, g: 0.3, b: 0.4, a: 0.5 });
  });

  it('should throw error for invalid Color format', () => {
    expect(() => parseColor('Invalid')).toThrow('Invalid Color format');
  });

  it('should throw error for Color with wrong number of components', () => {
    expect(() => parseColor('Color(1, 0, 0)')).toThrow('Invalid Color format');
  });

  it('should throw error for Color with non-numeric values', () => {
    expect(() => parseColor('Color(a, b, c, d)')).toThrow('Invalid Color format');
  });

  it('should parse black color', () => {
    const color = parseColor('Color(0, 0, 0, 1)');

    expect(color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('should parse white color', () => {
    const color = parseColor('Color(1, 1, 1, 1)');

    expect(color).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('should parse transparent color', () => {
    const color = parseColor('Color(1, 1, 1, 0)');

    expect(color).toEqual({ r: 1, g: 1, b: 1, a: 0 });
  });
});
