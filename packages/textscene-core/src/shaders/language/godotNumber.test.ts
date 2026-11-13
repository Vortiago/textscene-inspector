/**
 * Godot's float literal chain: its own decimal reader, then the text its compiler writes. The
 * expected bits are Godot's own, read back from `pnpm godot:probes`.
 */

import { describe, expect, it } from 'vitest';
import { godotFloatText, godotLiteralFloat, godotStrtod } from './godotNumber.js';

const bitsOf = (value: number) =>
  new Uint32Array(new Float32Array([value]).buffer)[0]!.toString(16).padStart(8, '0');

describe('godotStrtod', () => {
  it('reads the integer, fraction and exponent parts', () => {
    expect(godotStrtod('2.5e-3')).toBeCloseTo(0.0025, 15);
    expect(godotStrtod('1e3')).toBe(1000);
    expect(godotStrtod('.5')).toBe(0.5);
  });

  it('keeps the first 18 digits of a long mantissa', () => {
    expect(godotStrtod('1234567890123456789012')).toBe(1.2345678901234568e21);
  });
});

describe('godotFloatText', () => {
  it('writes 14 decimals and trims the zeros after the first', () => {
    expect(godotFloatText(0.5)).toBe('0.5');
    expect(godotFloatText(1)).toBe('1.0');
    expect(godotFloatText(-0)).toBe('-0.0');
  });

  it('writes a value under 1e-14 as zero', () => {
    expect(godotFloatText(1e-20)).toBe('0.0');
  });

  it('writes fewer decimals for each power of ten over 10', () => {
    expect(godotFloatText(Math.fround(123456789))).toBe('123456792.0');
  });

  it('writes an infinity as Godot does, which no GLSL compiler reads', () => {
    expect(godotFloatText(Infinity)).toBe('inf.0');
  });
});

describe('godotLiteralFloat', () => {
  it.each([
    ['0.1', '3dcccccd'],
    ['1e-20', '00000000'],
    ['1.5e-14', '283424dc'],
    ['0.000012345678', '374f2049'],
    ['3.4028234e38', '7f7fffff'],
    ['16777217.0', '4b800000'],
    ['7.0e-45', '00000000'],
  ])('reads %s as Godot draws it', (literal, bits) => {
    expect(bitsOf(godotLiteralFloat(literal))).toBe(bits);
  });

  it('refuses a literal past the float range, as Godot fails to compile it', () => {
    expect(() => godotLiteralFloat('1e39')).toThrow(/inf/);
  });
});
