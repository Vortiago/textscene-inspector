/**
 * `v.arrayLiteral` — the shape of a `Variant::ARRAY` property's literal.
 *
 * The whole point of the combinator is that the typed `Array[T]([…])` wrapper is
 * a PER-PROPERTY question: `Array::is_typed()` is what makes the serialiser emit
 * it (variant_parser.cpp:2341-2344), and only a property whose `ADD_PROPERTY`
 * carries `PROPERTY_HINT_ARRAY_TYPE` is ever written that way. So both arms are
 * asserted here, including the mismatched element type, which the shape alone
 * cannot catch.
 */

import { describe, expect, it } from 'vitest';
import { v } from './v.js';

const untyped = v.arrayLiteral('st_args');
const typed = v.arrayLiteral('custom_effects', { typedAs: 'RichTextEffect' });

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

  it('rejects the typed wrapper, which an unhinted property is never written with', () => {
    expect(untyped('st_args', 'Array[String]([])', 1)).not.toBeNull();
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
  });
});
