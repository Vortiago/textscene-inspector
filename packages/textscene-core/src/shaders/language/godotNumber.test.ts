/**
 * Godot's float literal chain: its own decimal reader, then the text its compiler writes. The
 * expected bits are Godot's own, from the literal probes of `pnpm godot:probes`.
 */

import { describe, expect, it } from 'vitest';
import { godotLiteralFloat } from './godotNumber.js';

const bitsOf = (value: number) =>
  new Uint32Array(new Float32Array([value]).buffer)[0]!.toString(16).padStart(8, '0');

describe('godotLiteralFloat', () => {
  it.each([
    ['0.0', '00000000'],
    ['1.0', '3f800000'],
    ['-1.0', 'bf800000'],
    ['0.5', '3f000000'],
    ['0.1', '3dcccccd'],
    ['3.14159265358979', '40490fdb'],
    ['1e3', '447a0000'],
    ['2.5e-3', '3b23d70a'],
    ['1e-20', '00000000'],
    ['1.5e-14', '283424dc'],
    ['1.0e-7', '33d6bf95'],
    ['0.000012345678', '374f2049'],
    ['3.4028234e38', '7f7fffff'],
    ['1e38', '7e967699'],
    ['123456789.0', '4ceb79a3'],
    ['16777217.0', '4b800000'],
    ['1.f', '3f800000'],
    ['2.5f', '40200000'],
    ['.5', '3f000000'],
    ['1e+2', '42c80000'],
    ['-0.0', '80000000'],
    ['1E2', '42c80000'],
    ['0.30000001192092896', '3e99999a'],
    ['7.0e-45', '00000000'],
  ])('reads %s as Godot draws it', (literal, bits) => {
    expect(bitsOf(godotLiteralFloat(literal))).toBe(bits);
  });

  it('refuses a literal past the float range, as Godot fails to compile it', () => {
    expect(() => godotLiteralFloat('1e39')).toThrow(/inf/);
  });
});
