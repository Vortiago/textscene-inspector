/**
 * `glslFloat` is a codegen guard, not a parity constant: its contract is the
 * GLSL ES grammar's floating-point literal, which has no int→float coercion in
 * a constant initialiser and no spelling at all for `NaN` / `Infinity`. A value
 * this emits wrong does not render wrong — the shader fails to compile and the
 * whole frame is lost, which is why the malformed cases matter as much as the
 * ordinary ones.
 */

import { describe, expect, it } from 'vitest';
import { glslFloat } from './glslLiterals';

/** The GLSL ES 1.0 floating-point literal forms, as a single acceptor. */
const GLSL_FLOAT = /^-?(\d+\.\d*|\.\d+|\d+\.?\d*e[+-]?\d+)$/;

describe('glslFloat — ordinary values', () => {
  it('gives a whole number the decimal point GLSL requires', () => {
    expect(glslFloat(1)).toBe('1.0');
    expect(glslFloat(0)).toBe('0.0');
    expect(glslFloat(12)).toBe('12.0');
  });

  it('leaves a fractional value alone — it already reads as a float', () => {
    expect(glslFloat(0.5)).toBe('0.5');
    expect(glslFloat(0.0001)).toBe('0.0001');
  });

  it('carries the sign through both shapes', () => {
    expect(glslFloat(-3)).toBe('-3.0');
    expect(glslFloat(-0.25)).toBe('-0.25');
  });

  it('emits the Godot glow defaults these builders actually bake', () => {
    // The default level weights and knee width, i.e. the values every generated
    // glow shader carries.
    expect(glslFloat(0.8)).toBe('0.8');
    expect(glslFloat(2)).toBe('2.0');
    expect(glslFloat(12)).toBe('12.0');
  });
});

describe('glslFloat — values GLSL cannot spell', () => {
  it('turns a non-finite value into 0.0 rather than an uncompilable literal', () => {
    // A malformed scene must render without glow, not fail to compile: GLSL has
    // no `NaN` or `Infinity` token at all.
    expect(glslFloat(Number.NaN)).toBe('0.0');
    expect(glslFloat(Number.POSITIVE_INFINITY)).toBe('0.0');
    expect(glslFloat(Number.NEGATIVE_INFINITY)).toBe('0.0');
  });

  it('lets the exponent carry the type past the point JS switches notation', () => {
    // `String(1e21)` is `1e+21`, and `1e+21.0` is not a literal — the exponent
    // form is already a float, so the decimal must NOT be appended. The `+` goes
    // because GLSL accepts it but Godot's own generated shaders omit it.
    expect(glslFloat(1e21)).toBe('1e21');
    expect(glslFloat(1.5e22)).toBe('1.5e22');
  });

  it('keeps a negative exponent, which is a float literal already', () => {
    expect(glslFloat(1e-7)).toBe('1e-7');
  });
});

describe('glslFloat — every output is a literal GLSL accepts', () => {
  it('emits a well-formed literal for the whole range these builders see', () => {
    const values = [
      0, 1, -1, 0.5, -0.25, 0.0001, 12, 16.29, 1e21, -1e21, 1e-7, Number.NaN,
      Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER,
    ];
    for (const value of values) {
      expect(glslFloat(value), `glslFloat(${value})`).toMatch(GLSL_FLOAT);
    }
  });
});
