/**
 * `v.arrayLiteral`: which typed `Array[T]([…])` values load depends on the setter.
 * A `TypedArray<T>` slot refuses another element type (`Array::assign`), and a
 * `const Array &` slot takes every one. What the serialiser emits
 * (`Array::is_typed()`, variant_parser.cpp:2341-2344) never bounds the loader.
 */

import { describe, expect, it } from 'vitest';
import { v, arrayLiteralElements } from './v.js';

const untyped = v.arrayLiteral('st_args');
const typed = v.arrayLiteral('custom_effects', { typedAs: 'RichTextEffect' });
const anyType = v.arrayLiteral('shapes', { anyElementType: true });

describe('v.arrayLiteral (untyped)', () => {
  it.each([
    ['the empty array Godot writes as the default', '[]'],
    ['a populated array', '[1, 2, 3]'],
    ['a nested array', '[[1], [2]]'],
    ['an array spanning lines', '[\n  1,\n  2\n]'],
  ])('accepts %s', (_label, value) => {
    expect(untyped('st_args', value, 1)).toBeNull();
  });

  it.each([
    ['a bare word', 'nope'],
    ['a dictionary literal', '{}'],
    ['an unclosed bracket', '[1, 2'],
  ])('rejects %s', (_label, value) => {
    const error = untyped('st_args', value, 1);
    expect(error).not.toBeNull();
    expect(error!.code).toBe('INVALID_ST_ARGS_FORMAT');
  });

  it('rejects the typed wrapper until the call site reads its setter', () => {
    // The narrow default: neither option passed means nobody has read what the
    // setter takes yet. `anyElementType` is how a `const Array &` slot says so.
    expect(untyped('st_args', 'Array[String]([])', 1)).not.toBeNull();
  });
});

/**
 * `anyElementType`: a slot whose setter takes a bare `const Array &`, or whose
 * `_set` tests only `p_value.get_type() != Variant::ARRAY`. A typed Array is
 * `Variant::ARRAY`, so every element type loads.
 */
describe('v.arrayLiteral (any element type)', () => {
  it.each(['[]', '[1, 2]', 'Array[int]([0, 4, 2, 4])', 'Array[Variant]([])'])(
    'accepts %s',
    (value) => {
      expect(anyType('shapes', value, 1)).toBeNull();
    }
  );

  it('still rejects a value that is no array at all', () => {
    expect(anyType('shapes', '5', 1)).not.toBeNull();
    expect(anyType('shapes', 'Array[int](5)', 1)).not.toBeNull();
  });

  it('advertises the wrapper without naming one element type', () => {
    expect(anyType.accepts).toBe('Array literal ([...] or Array[T]([...]))');
  });
});

describe('arrayLiteralElements', () => {
  it('reads the body of the bare literal', () => {
    expect(arrayLiteralElements('[0, 4, 2]')).toBe('0, 4, 2');
    expect(arrayLiteralElements('  [ ]  ')).toBe(' ');
  });

  it('reads the body from INSIDE the typed wrapper, not off the head', () => {
    // `value.trim().slice(1, -1)` gives `rray[int]([0, 4, 2`, text that is not
    // the array.
    expect(arrayLiteralElements('Array[int]([0, 4, 2])')).toBe('0, 4, 2');
    expect(arrayLiteralElements('Array[ Vector2i ]([Vector2i(0, 0)])')).toBe('Vector2i(0, 0)');
    expect(arrayLiteralElements('Array[int]([])')).toBe('');
  });
});

describe('v.arrayLiteral (typed)', () => {
  it('accepts the wrapper naming its own element type', () => {
    expect(typed('custom_effects', 'Array[RichTextEffect]([])', 1)).toBeNull();
  });

  it('accepts the bare form too: TypedArray<T>(const Array &) assigns an untyped array', () => {
    expect(typed('custom_effects', '[]', 1)).toBeNull();
  });

  it('rejects a wrapper naming a DIFFERENT element type', () => {
    // Array::assign refuses a typed array whose type is not the property's, so
    // matching the wrapper shape alone would let this through.
    const error = typed('custom_effects', 'Array[Dictionary]([])', 1);
    expect(error).not.toBeNull();
    expect(error!.code).toBe('INVALID_CUSTOM_EFFECTS_FORMAT');
  });

  it('names both accepted spellings in what it advertises', () => {
    expect(typed.accepts).toBe('Array literal ([...] or Array[RichTextEffect]([...]))');
    expect(untyped.accepts).toBe('Array literal ([...])');
  });

  it('is classified format-only, since it rejects nothing Godot would load', () => {
    expect(typed.formatOnly).toBe(true);
    expect(untyped.formatOnly).toBe(true);
    expect(anyType.formatOnly).toBe(true);
  });
});
