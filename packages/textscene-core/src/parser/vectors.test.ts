/**
 * parseVector2 and parseVector3 match a trimmed literal against an anchored regex from FLOAT_PATTERN_SOURCE:
 * scientific notation parses (Godot emits `1e-05`), and `1.2.3` or a lone `-` throws.
 * The `vec2Or` family in valueParsers.ts adds fallback-on-error.
 */
import { describe, it, expect } from 'vitest';
import { parseQuaternion, parseVector2, parseVector3 } from './vectors';

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

  it('reads a literal with surrounding white space, which `get_token` skips (variant_parser.cpp:416-418)', () => {
    expect(parseVector2(' Vector2(1, 2) ')).toEqual({ x: 1, y: 2 });
    expect(parseVector2('\tVector2( 1 ,\t2 )\t')).toEqual({ x: 1, y: 2 });
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

/**
 * `slotTupleRegex` admits `Vector2i`/`Vector3i` into a float slot, since
 * `can_convert_strict` converts them, but `_parse_construct<int32_t>`
 * (`variant_parser.cpp:721-733`) narrows their arguments to int32 before the widening.
 */
describe('parseQuaternion', () => {
  it('parses a standard quaternion, x first and w last', () => {
    expect(parseQuaternion('Quaternion(0, 0, 0.5, 0.866025)')).toEqual({ x: 0, y: 0, z: 0.5, w: 0.866025 });
  });

  it('tolerates white space and scientific notation', () => {
    expect(parseQuaternion(' Quaternion ( 1e-2 , 0,0 , 1 ) ')).toEqual({ x: 0.01, y: 0, z: 0, w: 1 });
  });

  it('throws on wrong arity, a non-number and a component that overflows', () => {
    expect(() => parseQuaternion('Quaternion(0, 0, 1)')).toThrow('Invalid Quaternion');
    expect(() => parseQuaternion('Quaternion(a, 0, 0, 1)')).toThrow('Invalid Quaternion');
    expect(() => parseQuaternion('Quaternion(1e999, 0, 0, 1)')).toThrow('Non-finite Quaternion');
  });
});

describe('an i-suffixed spelling in a float slot', () => {
  it('narrows each component to int32 the way Godot stores it', () => {
    expect(parseVector2('Vector2i(4294967295, 0)')).toEqual({ x: -1, y: 0 });
    expect(parseVector3('Vector3i(4294967295, 0, 0)')).toEqual({ x: -1, y: 0, z: 0 });
  });

  it('truncates a fractional component rather than keeping it', () => {
    expect(parseVector2('Vector2i(1.5, 2)')).toEqual({ x: 1, y: 2 });
  });

  it('leaves the canonical float spelling alone', () => {
    expect(parseVector2('Vector2(4294967295, 1.5)')).toEqual({ x: 4294967295, y: 1.5 });
    expect(parseVector3('Vector3(1.5, 2.5, 3.5)')).toEqual({ x: 1.5, y: 2.5, z: 3.5 });
  });
});

describe('parseVector2 on a Vector2i spelling', () => {
  it('reads the int32 pair Godot stores', () => {
    expect(parseVector2('Vector2i(4294967295, 0.5)')).toEqual({ x: -1, y: 0 });
  });

  it('wraps a component past the round-trip band to the number Godot stores', () => {
    expect(parseVector2('Vector2i(4294967296, 5)')).toEqual({ x: 0, y: 5 });
  });

  it('throws on a FLOAT component outside int32, which Godot leaves undefined', () => {
    expect(() => parseVector2('Vector2i(1e10, 0.5)')).toThrow('Non-finite Vector2');
  });
});

describe('parseVector3 white space', () => {
  it('reads a literal with surrounding white space, which `get_token` skips (variant_parser.cpp:416-418)', () => {
    expect(parseVector3(' \tVector3(1, 2, 3) \t ')).toEqual({ x: 1, y: 2, z: 3 });
  });
});
