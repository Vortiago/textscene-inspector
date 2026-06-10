/**
 * godotColorToLinear: the single sRGB→linear seam between Godot Color
 * literals and three.js materials. Reference values are three's own sRGB
 * EOTF: linear = c/12.92 for c ≤ 0.04045, else ((c+0.055)/1.055)^2.4.
 *
 * Also verifies exponent-notation Color components end-to-end:
 * FLOAT_PATTERN_SOURCE (parser/vectors.ts) admits `5e-1`-style floats, so
 * parseColor → godotColorToLinear must round-trip them. parseColor's
 * non-exponent cases live in utils/colorParser.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { godotColorToLinear } from './godotColor';
import { parseColor } from '../utils/colorParser';

describe('godotColorToLinear', () => {
  it('keeps the sRGB fixed points: black stays 0, white stays 1', () => {
    const black = godotColorToLinear({ r: 0, g: 0, b: 0 });
    expect(black.r).toBe(0);
    expect(black.g).toBe(0);
    expect(black.b).toBe(0);

    const white = godotColorToLinear({ r: 1, g: 1, b: 1 });
    expect(white.r).toBeCloseTo(1, 10);
    expect(white.g).toBeCloseTo(1, 10);
    expect(white.b).toBeCloseTo(1, 10);
  });

  it('converts mid-range sRGB via the gamma segment (0.5 → ≈0.2140)', () => {
    const c = godotColorToLinear({ r: 0.5, g: 0.5, b: 0.5 });
    expect(c.r).toBeCloseTo(0.21404114, 6);
    expect(c.g).toBeCloseTo(0.21404114, 6);
    expect(c.b).toBeCloseTo(0.21404114, 6);
  });

  it('converts near-black via the linear segment (c ≤ 0.04045 → c/12.92)', () => {
    const c = godotColorToLinear({ r: 0.003, g: 0, b: 0.04 });
    expect(c.r).toBeCloseTo(0.003 / 12.92, 8);
    expect(c.b).toBeCloseTo(0.04 / 12.92, 8);
  });

  it('converts each channel independently', () => {
    const c = godotColorToLinear({ r: 1, g: 0.5, b: 0.25 });
    expect(c.r).toBeCloseTo(1, 10);
    expect(c.g).toBeCloseTo(0.21404114, 6);
    expect(c.b).toBeCloseTo(0.05087609, 6);
  });
});

describe('exponent-notation Color components, end-to-end', () => {
  it('parseColor accepts exponent components (5e-1, 1e0, 2.5E-1)', () => {
    const parsed = parseColor('Color(5e-1, 1e0, 2.5E-1, 1e0)');
    expect(parsed).toEqual({ r: 0.5, g: 1, b: 0.25, a: 1 });
  });

  it('exponent components survive the full parse → linear conversion', () => {
    const linear = godotColorToLinear(parseColor('Color(5e-1, 1e0, 2.5E-1, 1)'));
    expect(linear.r).toBeCloseTo(0.21404114, 6); // sRGB 0.5
    expect(linear.g).toBeCloseTo(1, 10); // sRGB 1.0
    expect(linear.b).toBeCloseTo(0.05087609, 6); // sRGB 0.25
  });

  it('tiny exponent components land in the linear EOTF segment', () => {
    // 2.5e-3 = 0.0025 ≤ 0.04045 → divided by 12.92, not gamma-expanded.
    const linear = godotColorToLinear(parseColor('Color(2.5e-3, 0, 0, 1)'));
    expect(linear.r).toBeCloseTo(0.0025 / 12.92, 8);
  });

  it('positive-signed exponents parse too (+5.0e-1)', () => {
    const parsed = parseColor('Color(+5.0e-1, 0, 0, 1)');
    expect(parsed.r).toBeCloseTo(0.5, 10);
  });
});
