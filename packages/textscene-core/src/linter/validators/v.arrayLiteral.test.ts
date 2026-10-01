/**
 * `v.arrayLiteral`: which typed `Array[T]([…])` values load depends on the setter.
 * A `const Array &` setter keeps any array (`array.cpp:217-227`), so the untyped
 * combinator takes every wrapper and cites nothing. A typed slot refuses another
 * element type, and the call site cites where: `Array::assign`
 * (`array.cpp:275-277`) behind a `TypedArray<T>` setter, or only the
 * `PROPERTY_HINT_ARRAY_TYPE` behind a bare one. What the serialiser emits
 * (`Array::is_typed()`, variant_parser.cpp:2341-2344) never bounds the loader.
 */

import { describe, expect, it } from 'vitest';
import { v, arrayLiteralElements } from './v.js';

const untyped = v.arrayLiteral('st_args');
const enforced = v.arrayLiteral('connections', { typedAs: 'Dictionary', enforced: 'array.cpp:275-277' });
const hinted = v.arrayLiteral('custom_effects', {
  typedAs: 'RichTextEffect',
  hinted: 'rich_text_label.cpp:7773',
});

describe('v.arrayLiteral (untyped)', () => {
  it.each([
    ['the empty array Godot writes as the default', '[]'],
    ['a populated array', '[1, 2, 3]'],
    ['a nested array', '[[1], [2]]'],
    ['an array spanning lines', '[\n  1,\n  2\n]'],
    ['a typed wrapper, which the setter keeps as it is', 'Array[String]([])'],
    ['a typed wrapper with elements', 'Array[int]([0, 4, 2, 4])'],
  ])('accepts %s', (_label, value) => {
    expect(untyped('st_args', value, 1)).toBeNull();
  });

  it.each([
    ['a bare word', 'nope'],
    ['a number', '5'],
    ['a dictionary literal', '{}'],
    ['an unclosed bracket', '[1, 2'],
    ['a wrapper around no array', 'Array[int](5)'],
  ])('rejects %s', (_label, value) => {
    const error = untyped('st_args', value, 1);
    expect(error).toBeAtTier('error');
    expect(error!.code).toBe('INVALID_ST_ARGS_FORMAT');
  });

  it('advertises the wrapper without naming one element type', () => {
    expect(untyped.accepts).toBe('Array literal ([...] or Array[T]([...]))');
  });

  it('is format-only: it refuses only text the tokenizer cannot read as an Array', () => {
    expect(untyped.formatOnly).toBe(true);
    expect(untyped.grounding).toBeUndefined();
  });
});

describe('v.arrayLiteral (typed, enforced by the setter)', () => {
  it('accepts the wrapper naming its own element type, and the bare form', () => {
    // TypedArray<T>(const Array &) assigns an untyped array (typed_array.h:43-49).
    expect(enforced('connections', 'Array[Dictionary]([])', 1)).toBeNull();
    expect(enforced('connections', '[]', 1)).toBeNull();
  });

  it('errors on a wrapper naming a different element type', () => {
    const error = enforced('connections', 'Array[int]([1])', 1);
    expect(error).toBeAtTier('error');
    expect(error!.code).toBe('INVALID_CONNECTIONS_VALUE');
    expect(error!.message).toContain('array.cpp:275-277');
  });

  it('still errors on a value that is no array at all, as a format error', () => {
    expect(enforced('connections', '{}', 1)?.code).toBe('INVALID_CONNECTIONS_FORMAT');
  });

  it('carries its citation instead of the format-only claim', () => {
    expect(enforced.grounding).toEqual({ kind: 'enforced', cite: 'array.cpp:275-277' });
    expect(enforced.formatOnly).toBeUndefined();
    expect(enforced.accepts).toBe('Array literal ([...] or Array[Dictionary]([...]))');
  });
});

describe('v.arrayLiteral (typed, stated by the hint only)', () => {
  it('warns on a wrapper naming a different element type, which the bare setter stores', () => {
    const report = hinted('custom_effects', 'Array[Dictionary]([])', 1);
    expect(report).toBeAtTier('warning');
    expect(report!.message).toContain('rich_text_label.cpp:7773');
  });

  it('accepts its own element type', () => {
    expect(hinted('custom_effects', 'Array[RichTextEffect]([])', 1)).toBeNull();
  });

  it('carries the hinted grounding', () => {
    expect(hinted.grounding).toEqual({ kind: 'hinted', cite: 'rich_text_label.cpp:7773' });
    expect(hinted.formatOnly).toBeUndefined();
  });
});

describe('v.arrayLiteral (typed) signature', () => {
  it('requires a citation for the element-type refusal', () => {
    // @ts-expect-error: a typed slot names where its refusal comes from.
    const uncited = v.arrayLiteral('connections', { typedAs: 'Dictionary' });
    expect(uncited).toBeTypeOf('function');
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
