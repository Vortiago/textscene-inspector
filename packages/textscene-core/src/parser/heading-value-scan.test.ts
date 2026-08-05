/**
 * Contract for the heading-attribute scanner arms the #150 and #393 contracts
 * leave unpinned.
 *
 * Those two files pin the STRUCTURED value forms (`Name(...)`, `[...]`, quoted
 * strings with delimiters inside). Between them they never pin the arm that
 * handled everything else — the old alternation's `[^\s]+` fallback — nor what
 * happens when a heading is malformed, tab-separated, or carries an escape
 * INSIDE a structured value. Every rung here is a behaviour the pre-#393 regex
 * had and a hand-written scanner can silently lose while both contracts stay
 * green.
 *
 * Four axes, all asserted at `parseHeading`'s own boundary:
 *
 *  1. BARE TOKEN AT ITS WIDEST. An unquoted value runs to the next whitespace,
 *     punctuation included (`res://art/icon.png`, `-1`, `1.5`). Narrowing it to
 *     an identifier class truncates the value AND, because the scan then stops
 *     mid-token, drops every attribute after it.
 *  2. SEPARATOR IS `\s`, NOT `' '`. A tab between attributes — or between the
 *     section keyword and its first attribute — must separate them, not become
 *     part of a key. This parser's job is leniency toward hand-edited input;
 *     Godot's own writer emits single spaces, so the corpus cannot pin this.
 *  3. RECOVERY, NOT ABANDONMENT. A stray token, an empty value or an
 *     unterminated delimiter costs at most its own attribute: the scan resyncs
 *     at the next whitespace and the REMAINING attributes still parse. Each
 *     rung asserts the complete surviving attribute set, so "give up here"
 *     cannot pass.
 *  4. RAW-TEXT BOUNDARY. A structured value is captured verbatim, escapes
 *     intact, so it stays re-parseable; only a QUOTED scalar is unwrapped, and
 *     it decodes `\"` alone. Decoding a heading value further is the node
 *     parsers' business (`unquoteString` on a property), not the scanner's.
 */

import { describe, it, expect } from 'vitest';
import { parseHeading } from './utils';

describe('parseHeading bare (unquoted) attribute values', () => {
  it('captures an unquoted value up to whitespace, punctuation included', () => {
    const result = parseHeading('[ext_resource path=res://art/icon.png type=Texture id=1]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      path: 'res://art/icon.png',
      type: 'Texture',
      id: '1',
    });
  });

  it('captures unquoted values that start with or contain punctuation', () => {
    const result = parseHeading('[node name="A" index=-1 scale=1.5 parent="Level"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      name: 'A',
      index: '-1',
      scale: '1.5',
      parent: 'Level',
    });
  });

  it('parses a heading whose values are all unquoted', () => {
    const result = parseHeading('[connection signal=pressed from=Button to=. method=_on_pressed]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      signal: 'pressed',
      from: 'Button',
      to: '.',
      method: '_on_pressed',
    });
  });

  it('does not read a parenthesised NEXT token as part of a bare value', () => {
    // A constructor is an identifier IMMEDIATELY followed by `(`; a space
    // between them ends the value instead of over-capturing across the boundary.
    const result = parseHeading('[node name="X" type=Node2D (junk) parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X', type: 'Node2D', parent: '.' });
  });
});

describe('parseHeading separates attributes on any whitespace', () => {
  it('treats a tab between attributes as a separator', () => {
    const result = parseHeading('[node name="X"\tparent="."\ttype="Node2D"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X', parent: '.', type: 'Node2D' });
  });

  it('treats a tab after the section keyword as the type/attributes split', () => {
    const result = parseHeading('[node\tname="X" parent="."]');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('node');
    expect(result!.attributes).toEqual({ name: 'X', parent: '.' });
  });
});

describe('parseHeading recovers from a malformed attribute', () => {
  it('skips a stray token and keeps parsing the attributes after it', () => {
    const result = parseHeading('[node name="X" #junk parent="." type="Node2D"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X', parent: '.', type: 'Node2D' });
  });

  it('skips junk directly appended to a quoted value', () => {
    const result = parseHeading('[node name="A"B parent="." type="Node2D"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'A', parent: '.', type: 'Node2D' });
  });

  it('keeps a second "=" inside an unquoted value', () => {
    const result = parseHeading('[node name="X" foo=a=b parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X', foo: 'a=b', parent: '.' });
  });

  it('drops an attribute with no value instead of swallowing the next one', () => {
    const result = parseHeading('[node name="X" type= parent="Foo" index="2"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X', parent: 'Foo', index: '2' });
  });

  it('keeps an explicitly empty quoted value', () => {
    const result = parseHeading('[node name="" parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: '', parent: '.' });
  });

  it('recovers the attributes after an unterminated constructor', () => {
    const result = parseHeading('[node name="A" transform=Transform3D(1, 0, 0 parent="." type="Node2D"]');
    expect(result).not.toBeNull();
    expect(result!.attributes.parent).toBe('.');
    expect(result!.attributes.type).toBe('Node2D');
    expect(result!.attributes.transform).toBe('Transform3D(1,');
  });

  it('recovers the attributes after an unterminated bracketed array', () => {
    const result = parseHeading('[node name="A" groups=["a", "b" parent="." type="Node2D"]');
    expect(result).not.toBeNull();
    expect(result!.attributes.parent).toBe('.');
    expect(result!.attributes.type).toBe('Node2D');
    expect(result!.attributes.groups).toBe('["a",');
  });

  it('recovers the attributes after an unterminated quoted value', () => {
    const result = parseHeading('[node name="A" type="Node2D" parent=". index=5]');
    expect(result).not.toBeNull();
    expect(result!.attributes.index).toBe('5');
    expect(result!.attributes.parent).toBe('".');
  });

  it('terminates on pathological input', () => {
    expect(parseHeading('[node = = =]')!.attributes).toEqual({});
    expect(parseHeading('[node ]]]')!.attributes).toEqual({});
    expect(parseHeading('[node "" ]')!.attributes).toEqual({});
    expect(parseHeading('[node type=]')!.attributes).toEqual({});
    expect(parseHeading('[node a=((((]')!.attributes).toEqual({ a: '((((' });
  });
});

describe('parseHeading value text', () => {
  it('captures an escaped quote inside a bracketed array verbatim', () => {
    const result = parseHeading('[node name="X" groups=["say \\"hi\\"", "b"] parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes.groups).toBe('["say \\"hi\\"", "b"]');
    expect(result!.attributes.parent).toBe('.');
  });

  it('captures an escaped quote inside a constructor verbatim', () => {
    const result = parseHeading('[node name="X" node_paths=PackedStringArray("a\\"b", "c") parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes.node_paths).toBe('PackedStringArray("a\\"b", "c")');
    expect(result!.attributes.parent).toBe('.');
  });

  it('leaves a backslash escape inside a structured value undecoded', () => {
    const result = parseHeading('[node name="X" node_paths=PackedStringArray("a\\nb") parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes.node_paths).toBe('PackedStringArray("a\\nb")');
  });

  it('unwraps a quoted scalar and decodes \\" only', () => {
    const result = parseHeading('[node name="say \\"hi\\"" path="a\\nb" type="Node2D"]');
    expect(result).not.toBeNull();
    expect(result!.attributes.name).toBe('say "hi"');
    // heading values are source text: a node parser decodes the rest downstream
    expect(result!.attributes.path).toBe('a\\nb');
  });
});
