import { describe, it, expect } from 'vitest';
import { IS_VALID_INT_RE, literalText, splitTopLevel } from './string.js';

describe('literalText', () => {
  it.each([
    ['"walk"', 'walk'],
    ['&"spin"', 'spin'],
    ['^"Body/Mesh"', 'Body/Mesh'],
    ['&""', ''],
    ['  &"pad"  ', 'pad'],
  ])('takes the jacket off %s', (raw, expected) => {
    expect(literalText(raw)).toBe(expected);
  });

  // The contents are what `set_animation` compares, so whitespace INSIDE the
  // quotes is part of the name and `" default " == "default"` stays false.
  it('keeps whitespace that was inside the quotes', () => {
    expect(literalText('" default "')).toBe(' default ');
  });

  it('keeps an embedded quote', () => {
    expect(literalText('"a\\"b"')).toBe('a\\"b');
  });

  it.each(['"unterminated', 'unopened"', `"mixed'`])(
    'leaves an unmatched quote alone: %s',
    (raw) => {
      expect(literalText(raw)).toBe(raw);
    }
  );

  it('trims a value that was never quoted and leaves the rest', () => {
    expect(literalText('  default  ')).toBe('default');
  });
});

describe('IS_VALID_INT_RE', () => {
  it.each(['0', '-7', '+7', '000'])('accepts %s', (s) => {
    expect(IS_VALID_INT_RE.test(s)).toBe(true);
  });

  it.each(['', ' 1', '1 ', '1.0', 'a1b2', '--1', '1e3'])('rejects %s', (s) => {
    expect(IS_VALID_INT_RE.test(s)).toBe(false);
  });
});

describe('splitTopLevel', () => {
  it('splits a flat body', () => {
    expect(splitTopLevel('1, 2, 3')).toEqual(['1', '2', '3']);
  });

  it('yields no elements for an empty body', () => {
    expect(splitTopLevel('')).toEqual([]);
    expect(splitTopLevel('   ')).toEqual([]);
  });

  it('keeps a one-element body whole', () => {
    expect(splitTopLevel('SubResource("a")')).toEqual(['SubResource("a")']);
  });

  it('ignores a comma nested inside parens', () => {
    expect(splitTopLevel('Vector2(1, 2), Vector2(3, 4)')).toEqual([
      'Vector2(1, 2)',
      'Vector2(3, 4)',
    ]);
  });

  it('ignores a comma nested inside brackets', () => {
    expect(splitTopLevel('[1, 2], [3, 4]')).toEqual(['[1, 2]', '[3, 4]']);
  });

  it('treats parens and brackets as one depth counter, the way Godot nests them', () => {
    // `Array[NodePath]([NodePath("a"), NodePath("b")])` puts a paren body
    // inside a bracket body, so the two cannot be tracked separately.
    expect(splitTopLevel('Array[NodePath]([NodePath("a"), NodePath("b")]), 7')).toEqual([
      'Array[NodePath]([NodePath("a"), NodePath("b")])',
      '7',
    ]);
  });

  it('ignores a comma inside a quoted run', () => {
    expect(splitTopLevel('"a,b", "c"')).toEqual(['"a,b"', '"c"']);
  });

  it('does not end a quote on an escaped quote', () => {
    expect(splitTopLevel('"a\\",b", "c"')).toEqual(['"a\\",b"', '"c"']);
  });

  it('ignores a bracket inside a quoted run', () => {
    expect(splitTopLevel('"a(b", "c"')).toEqual(['"a(b"', '"c"']);
  });

  it('trims surrounding whitespace from every element', () => {
    expect(splitTopLevel('  1 ,  2  ')).toEqual(['1', '2']);
  });

  it('keeps an empty trailing element, since a trailing comma is one', () => {
    expect(splitTopLevel('1,')).toEqual(['1', '']);
  });
});
