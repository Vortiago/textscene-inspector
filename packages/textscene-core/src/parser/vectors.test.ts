/**
 * Direct tests for parseVector2 / parseVector3.
 *
 * These pin the parsing contract: a strict anchored regex built from
 * FLOAT_PATTERN_SOURCE — scientific notation parses (Godot emits
 * `1e-05` for small values), while malformed components like `1.2.3`
 * or a lone `-` fail the whole match and throw. Callers that need
 * fallback-on-error semantics wrap these in `vec2Or`-style helpers
 * (see valueParsers.ts).
 */
import { describe, it, expect } from 'vitest';
import { parseVector2, parseVector3 } from './vectors';

describe('parseVector2', () => {
  it('parses a standard vector', () => {
    expect(parseVector2('Vector2(3, 4)')).toEqual({ x: 3, y: 4 });
  });

  it('parses negative and decimal components', () => {
    expect(parseVector2('Vector2(-1.5, -0.25)')).toEqual({ x: -1.5, y: -0.25 });
  });

  it('tolerates flexible internal whitespace, including before the paren', () => {
    expect(parseVector2('Vector2(1,2)')).toEqual({ x: 1, y: 2 });
    expect(parseVector2('Vector2 (  1 ,  2  )')).toEqual({ x: 1, y: 2 });
  });

  it('rejects surrounding whitespace (anchored match)', () => {
    expect(() => parseVector2(' Vector2(1, 2)')).toThrow('Invalid Vector2 format');
    expect(() => parseVector2('Vector2(1, 2) ')).toThrow('Invalid Vector2 format');
  });

  it('parses scientific notation (Godot emits exponents for small values)', () => {
    expect(parseVector2('Vector2(1e3, 2)')).toEqual({ x: 1000, y: 2 });
    expect(parseVector2('Vector2(1, 2e-05)')).toEqual({ x: 1, y: 2e-5 });
    expect(parseVector2('Vector2(-1.5E+2, 0.5)')).toEqual({ x: -150, y: 0.5 });
  });

  it('throws on wrong arity, wrong constructor name, and empty input', () => {
    expect(() => parseVector2('Vector2(1)')).toThrow('Invalid Vector2 format');
    expect(() => parseVector2('Vector2(1, 2, 3)')).toThrow('Invalid Vector2 format');
    expect(() => parseVector2('vector2(1, 2)')).toThrow('Invalid Vector2 format');
    expect(() => parseVector2('Vector3(1, 2, 3)')).toThrow('Invalid Vector2 format');
    expect(() => parseVector2('')).toThrow('Invalid Vector2 format');
  });
});

describe('parseVector3', () => {
  it('parses a standard vector', () => {
    expect(parseVector3('Vector3(1, 2, 3)')).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('parses negative and decimal components', () => {
    expect(parseVector3('Vector3(-1.5, 0.5, -100)')).toEqual({ x: -1.5, y: 0.5, z: -100 });
  });

  it('tolerates flexible internal whitespace', () => {
    expect(parseVector3('Vector3(1,2,3)')).toEqual({ x: 1, y: 2, z: 3 });
    expect(parseVector3('Vector3 ( 1 , 2 , 3 )')).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('parses scientific notation (Godot emits exponents for small values)', () => {
    expect(parseVector3('Vector3(1e-05, 2, 3)')).toEqual({ x: 1e-5, y: 2, z: 3 });
    expect(parseVector3('Vector3(1.5e2, -2E-1, 3)')).toEqual({ x: 150, y: -0.2, z: 3 });
  });

  it('parses trailing-dot decimals, and refuses leading-dot ones', () => {
    // `get_token` requires a digit after the optional `-` (variant_parser.cpp:424),
    // so `.5` never reaches the number branch. Measured on 4.6.3: a scene
    // carrying `Vector2(.5, 2)` fails the load outright.
    expect(parseVector3('Vector3(1., 0.5, 2)')).toEqual({ x: 1, y: 0.5, z: 2 });
    expect(() => parseVector3('Vector3(1., .5, 2)')).toThrow('Invalid Vector3 format');
  });

  it('throws on wrong arity and empty input', () => {
    expect(() => parseVector3('Vector3(1, 2)')).toThrow('Invalid Vector3 format');
    expect(() => parseVector3('Vector3(1, 2, 3, 4)')).toThrow('Invalid Vector3 format');
    expect(() => parseVector3('Vector3()')).toThrow('Invalid Vector3 format');
    expect(() => parseVector3('')).toThrow('Invalid Vector3 format');
  });

  it('throws on malformed components instead of silently truncating', () => {
    // Pre-FLOAT_PATTERN_SOURCE, `[-\d.]+` let "1.2.3" truncate to 1.2 and
    // a lone "-" yield NaN. Both are now format errors the vec*Or wrappers
    // turn into warn-then-fall-back.
    expect(() => parseVector3('Vector3(1.2.3, 1, 2)')).toThrow('Invalid Vector3 format');
    expect(() => parseVector3('Vector3(-, 1, 2)')).toThrow('Invalid Vector3 format');
  });
});
