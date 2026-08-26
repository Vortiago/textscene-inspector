/**
 * Contract for the heading-attribute scanner arms the two structured-value
 * contracts beside it leave unpinned: the bare token, malformed input, and the
 * boundary between raw source text and a decoded value.
 *
 * Four axes, all asserted at `parseHeading`'s own boundary:
 *
 *  1. BARE TOKEN AT ITS WIDEST. An unquoted value runs to the next whitespace,
 *     punctuation included (`res://art/icon.png`, `-1`, `1.5`). Narrowing it to
 *     an identifier class truncates the value AND, because the scan then stops
 *     mid-token, drops every attribute after it.
 *  2. SEPARATOR IS `\s`, NOT `' '`. A tab or a non-breaking space between
 *     attributes — or between the section keyword and its first attribute —
 *     must separate them, not become part of a key. This parser's job is
 *     leniency toward hand-edited and pasted input; Godot's own writer emits
 *     single spaces, so the corpus cannot pin this.
 *  3. RECOVERY, NOT ABANDONMENT. A stray token, an empty value or an
 *     unterminated delimiter costs at most its own attribute: the scan resyncs
 *     and the REMAINING attributes still parse. Each rung asserts the complete
 *     surviving attribute set, so "give up here" cannot pass.
 *  4. RAW-TEXT BOUNDARY. A structured value is captured verbatim, escapes
 *     intact, so it stays re-parseable; only a QUOTED scalar — quoted at BOTH
 *     ends — is unwrapped, and it decodes `\"` alone. Decoding a heading value
 *     further is the node parsers' business (`unquoteString` on a property),
 *     not the scanner's.
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

  it('treats a non-breaking space between attributes as a separator', () => {
    // Godot rejects such a heading outright ("Unexpected character"), so this
    // is the lenient reading: split, and keep the node the tree needs.
    const result = parseHeading('[node name="X"\u00A0parent="."\uFEFFtype="Node2D"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X', parent: '.', type: 'Node2D' });
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

  it('steps over a stray "=" without losing the attribute behind it', () => {
    const result = parseHeading('[node name="X" =parent="." type="Node2D"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X', parent: '.', type: 'Node2D' });
  });

  it('drops an attribute with no value instead of swallowing the next one', () => {
    // A BARE identifier is the only form that cannot be told from the next
    // attribute; Godot rejects it as a value, so leaving it behind recovers.
    const result = parseHeading('[node name="X" type= parent="Foo" index="2"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X', parent: 'Foo', index: '2' });
  });

  // `get_token` breaks on `cchar <= 32` (`variant_parser.cpp:415-417`) and
  // `_parse_tag` calls it straight after `TK_EQUAL` (`:1861-1863`), so the
  // space is consumed before the value token is read. Reading these as a
  // missing value cost the heading its `name=` — an ERROR on a file that loads.
  it.each([
    ['a quoted string', '[node name= "Root" type="Node2D"]', { name: 'Root', type: 'Node2D' }],
    ['the type', '[node name="Root" type= "Node2D"]', { name: 'Root', type: 'Node2D' }],
    ['a number', '[node name="K" parent="." index= 0]', { name: 'K', parent: '.', index: '0' }],
    [
      'a constructor',
      '[node name="K" parent="." transform= Transform2D(1, 0, 0, 1, 2, 3)]',
      { name: 'K', parent: '.', transform: 'Transform2D(1, 0, 0, 1, 2, 3)' },
    ],
    [
      'an ext_resource path',
      '[ext_resource type="Texture2D" path= "res://a.png" id="1"]',
      { type: 'Texture2D', path: 'res://a.png', id: '1' },
    ],
  ])('reads %s across the space after "="', (_label, heading, attributes) => {
    const result = parseHeading(heading);
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual(attributes);
  });

  // The same `get_token` whitespace skip applies BEFORE the `=` too: it is read
  // by its own `get_token` call (`variant_parser.cpp:1855-1858`). Demanding the
  // `=` at the index the key scan stopped at cost the heading every attribute,
  // so the nodes lost their name, type and parent at once.
  it.each([
    ['before the "="', '[node name ="Root" type ="Node2D"]'],
    ['on both sides of it', '[node name = "Root" type = "Node2D"]'],
  ])('reads a key whose "=" is padded %s', (_label, heading) => {
    const result = parseHeading(heading);
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'Root', type: 'Node2D' });
  });

  // `resource_format_text.cpp:2127` stores `" binds= " + vars`, so every
  // connection carrying bound arguments puts a space between the `=` and the
  // array. Reading that as an empty value dropped the binds from scenes Godot
  // itself wrote, and the array is the ONLY form allowed to open across the
  // space — the test above still pins that a bare token does not.
  it('reads a bound-argument array across the space Godot writes after "binds="', () => {
    const result = parseHeading(
      '[connection signal="pressed" from="B" to="." method="_on" binds= [1, 2]]'
    );
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      signal: 'pressed',
      from: 'B',
      to: '.',
      method: '_on',
      binds: '[1, 2]',
    });
  });

  it('keeps an explicitly empty quoted value', () => {
    const result = parseHeading('[node name="" parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: '', parent: '.' });
  });

  it('recovers the attributes after an unterminated constructor', () => {
    const result = parseHeading('[node name="A" transform=Transform3D(1, 0, 0 parent="." type="Node2D"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      name: 'A',
      transform: 'Transform3D(1,',
      parent: '.',
      type: 'Node2D',
    });
  });

  it('recovers the attributes after an unterminated bracketed array', () => {
    const result = parseHeading('[node name="A" groups=["a", "b" parent="." type="Node2D"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      name: 'A',
      groups: '["a",',
      parent: '.',
      type: 'Node2D',
    });
  });

  it('recovers the attributes after an unterminated quoted value', () => {
    const result = parseHeading('[node name="A" type="Node2D" parent=". index=5]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      name: 'A',
      type: 'Node2D',
      parent: '".',
      index: '5',
    });
  });

  it('reads a lone quote as an empty value, not as a one-character name', () => {
    // `name` must stay falsy so the strict parser still reports it missing.
    const result = parseHeading('[node name=" type=]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: '' });
  });

  it('leaves a value whose closing quote is escaped verbatim', () => {
    // Both quotes after the opener are escaped, so the string never closes.
    // Unwrapping on a trailing `"` alone destroyed the `\\"` that keeps the raw
    // text re-parseable.
    const result = parseHeading(String.raw`[node name="a\"b\" index=5]`);
    expect(result!.attributes).toEqual({ name: String.raw`"a\"b\"`, index: '5' });
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

  it('leaves a value quoted at only its leading end verbatim, escapes undecoded', () => {
    // Decoding without unwrapping would destroy the `\"` that keeps the raw
    // text re-parseable, and invent a closing quote the source never had.
    const result = parseHeading('[node name="a\\"b index=5]');
    expect(result).not.toBeNull();
    expect(result!.attributes.name).toBe('"a\\"b');
    expect(result!.attributes.index).toBe('5');
  });
});

describe('parseHeading bounds a delimiter scan at the next attribute', () => {
  it('stops a constructor scan at the next attribute instead of swallowing it', () => {
    // `=` cannot appear unquoted inside a Godot heading value: constructor
    // arguments are values, dictionaries key on `:`, and a quoted string is
    // skipped whole. So an unquoted `=` is the next attribute, not content.
    const result = parseHeading('[node name="X" transform=Transform3D(1, 0 type="Node2D") parent="."]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({
      name: 'X',
      transform: 'Transform3D(1,',
      type: 'Node2D',
      parent: '.',
    });
  });

  it('stops an array scan at the next attribute instead of swallowing it', () => {
    const result = parseHeading('[node name="X" arr=[1, 2 parent="." type="Node2D"]');
    expect(result).not.toBeNull();
    expect(result!.attributes).toEqual({ name: 'X', arr: '[1,', parent: '.', type: 'Node2D' });
  });

  it('keeps an unclosed-constructor heading linear, not quadratic', () => {
    // An attribute that rescans to end-of-line before falling back hangs the
    // extension host on a long bracket line as the user types.
    const line = `[node ${'a=f( '.repeat(20000)}]`;
    const start = performance.now();
    const result = parseHeading(line);
    const elapsed = performance.now() - start;
    expect(result).not.toBeNull();
    expect(elapsed).toBeLessThan(500);
  });
});
