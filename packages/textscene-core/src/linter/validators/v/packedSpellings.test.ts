/**
 * A packed slot accepts three spellings: `can_convert_strict` lists ARRAY as a
 * source for every PACKED_* type (`variant.cpp:467-473`), so `filters = ["*.png"]`
 * and `split_offsets = Array[int]([3, 7])` load into their packed slots.
 */

import { describe, it, expect } from 'vitest';
import { v } from '../v.js';

const points = v.packedVector2Array('points');
const at = (value: string) => points('points', value, 1);

describe('a PackedVector2Array slot', () => {
  it('accepts the packed spelling Godot writes', () => {
    expect(at('PackedVector2Array(0, 0, 5, 5)')).toBeNull();
  });

  it('accepts the bare array spelling the slot converts', () => {
    expect(at('[Vector2(0, 0), Vector2(5, 5)]')).toBeNull();
  });

  it('accepts the typed-array spelling', () => {
    expect(at('Array[Vector2]([Vector2(0, 0), Vector2(5, 5)])')).toBeNull();
  });

  it('accepts an empty array in every spelling', () => {
    expect(at('PackedVector2Array()')).toBeNull();
    expect(at('[]')).toBeNull();
    expect(at('Array[Vector2]([])')).toBeNull();
  });

  it('accepts the convertible element spelling, at the slot\'s own arity', () => {
    // `Variant::operator Vector2()` reads a Vector2i verbatim
    // (`variant.cpp:1751-1756`), and `_convert_array` runs it per element
    // (`variant.cpp:2082-2091`), so this is a file Godot opens.
    expect(at('[Vector2i(0, 0), Vector2i(5, 5)]')).toBeNull();
    expect(at('Array[Vector2]([Vector2i(0, 0)])')).toBeNull();
    expect(at('[Vector2(0, 0), Vector2i(5, 5)]')).toBeNull();
  });

  it('still reports an element that is not a Vector2', () => {
    // A reshaping conversion, which `godot/variantConversion.ts` leaves out of
    // the accepted table on purpose; the arity check is what catches it.
    expect(at('[Vector3(0, 0, 0)]')?.severity).toBe('error');
    expect(at('[Vector2i(0, 0, 0)]')?.severity).toBe('error');
    expect(at('[oops]')?.severity).toBe('error');
  });

  it('still reports a non-numeric component in the packed spelling', () => {
    expect(at('PackedVector2Array(0, oops)')?.severity).toBe('error');
  });

  it('reports a value that is no array at all', () => {
    expect(at('Vector2(0, 0)')?.severity).toBe('error');
  });
});

describe('a PackedFloat32Array slot', () => {
  const offsets = v.packedFloat32Array('offsets', '0, 1');
  const f = (value: string) => offsets('offsets', value, 1);

  it('accepts all three spellings of a scalar array', () => {
    expect(f('PackedFloat32Array(0, 1)')).toBeNull();
    expect(f('[0, 1]')).toBeNull();
    expect(f('Array[float]([0, 1])')).toBeNull();
  });

  it('still reports a non-numeric element', () => {
    expect(f('[0, oops]')?.severity).toBe('error');
  });
});

describe('a PackedStringArray slot', () => {
  const filters = v.packedStringArray('filters', '"*.png"');
  const at = (value: string) => filters('filters', value, 1);

  it('accepts all three spellings, empty included', () => {
    expect(at('PackedStringArray("*.png", "*.jpg")')).toBeNull();
    expect(at('Array[String](["*.png"])')).toBeNull();
    expect(at('["*.png"]')).toBeNull();
    expect(at('PackedStringArray()')).toBeNull();
  });

  it('accepts one trailing comma in each spelling', () => {
    // The packed loop closes on `)` after a comma (variant_parser.cpp:1522-1525), and
    // `_parse_array` on `]` (:1658-1660).
    expect(at('PackedStringArray("*.png",)')).toBeNull();
    expect(at('Array[String](["*.png",])')).toBeNull();
    expect(at('["*.png",]')).toBeNull();
  });

  it('accepts a backslash that escapes a raw newline', () => {
    expect(at('PackedStringArray("a\\\nb")')).toBeNull();
  });

  it('reports a non-string element under the format code', () => {
    const error = at('PackedStringArray("*.png", 5)');
    expect(error?.code).toBe('INVALID_FILTERS_FORMAT');
    expect(error?.message).toContain('non-string');
  });

  it.each(['PackedStringArray(,)', '["*.png",,]', '[&"*.png"]'])(
    'reports a list the tokenizer refuses or a StringName element: %s',
    (value) => {
      expect(at(value)?.code).toBe('INVALID_FILTERS_FORMAT');
    }
  );

  it('reports a value that is no array at all, naming the example', () => {
    expect(at('"*.png"')?.message).toContain('PackedStringArray("*.png")');
  });
});
