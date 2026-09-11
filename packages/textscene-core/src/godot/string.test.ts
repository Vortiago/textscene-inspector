import { describe, it, expect } from 'vitest';
import { IS_VALID_INT_RE, literalText, splitTopLevel, stringToInt, toIntIndex , stringToFloat} from './string.js';

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

describe('stringToFloat', () => {
  it('reads an ordinary decimal', () => {
    expect(stringToFloat('12.5')).toBe(12.5);
    expect(stringToFloat('-3')).toBe(-3);
  });

  // `if (is_empty()) return 0` (`ustring.cpp:2681-2683`).
  it('reads an empty string as zero', () => {
    expect(stringToFloat('')).toBe(0);
  });

  // `built_in_strtod` takes the longest numeric prefix and stops; unlike the
  // TSCN literal reader, trailing text is ignored rather than refused.
  it('stops at the first character it cannot use', () => {
    expect(stringToFloat('75abc')).toBe(75);
    expect(stringToFloat('10%')).toBe(10);
  });

  it('reads text with no numeric prefix as zero', () => {
    expect(stringToFloat('top')).toBe(0);
    expect(stringToFloat('   ')).toBe(0);
  });

  // Godot's tokenizer has no `Infinity` spelling, so neither does this.
  it('refuses JavaScript’s own infinity spellings', () => {
    expect(stringToFloat('Infinity')).toBe(0);
    expect(stringToFloat('-Infinity')).toBe(0);
  });
});

describe('stringToInt', () => {
  it('reads the digits of an ordinary spelling', () => {
    expect(stringToInt('42')).toBe(42);
    expect(stringToInt('-42')).toBe(-42);
    expect(stringToInt('007')).toBe(7);
  });

  // `_to_int` has no early exit for a character it cannot use: it SKIPS it and
  // keeps scanning (ustring.cpp:2280-2293), so text `is_valid_int` rejects
  // still resolves to a number.
  it.each([
    ['x', 0],
    ['a1b2', 12],
    ['1 000', 1000],
  ])('skips a non-digit rather than stopping at it: %s', (raw, expected) => {
    expect(stringToInt(raw)).toBe(expected);
  });

  // `else if (integer == 0 && c == '-') positive = !positive;`
  // (ustring.cpp:2291-2292) — the sign is not a leading-position rule, it is a
  // flip on every `-` seen before the first non-zero digit accumulates.
  it.each([
    ['a-1', -1],
    ['-1', -1],
    ['--1', 1],
    ['---1', -1],
    // A `0` digit leaves the total at 0, so the second `-` still flips.
    ['-0-1', 1],
    ['1-2', 12],
  ])('flips the sign on a `-` seen while the total is still 0: %s', (raw, expected) => {
    expect(stringToInt(raw)).toBe(expected);
  });

  // `to` stops at the first `.` (ustring.cpp:2308), so the fractional half is
  // never scanned — not truncation of a parsed float, a shorter scan.
  it.each([
    ['12.9', 12],
    ['.5', 0],
    ['-0.5', 0],
    ['1.2.3', 1],
    ['12.-9', 12],
  ])('scans only as far as the first dot: %s', (raw, expected) => {
    expect(stringToInt(raw)).toBe(expected);
  });

  it('reads an empty string as 0', () => {
    expect(stringToInt('')).toBe(0);
  });

  it('holds every value a JS integer spells exactly', () => {
    expect(stringToInt('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER);
    expect(stringToInt('-9007199254740991')).toBe(Number.MIN_SAFE_INTEGER);
  });

  // Past 2^53 the double is no longer the int64 the text states, and the
  // engine's own saturation (ustring.cpp:2283-2284) is further out still.
  it.each(['9007199254740993', '-9007199254740993', '9223372036854775808', '-99999999999999999999'])(
    'refuses a value no double spells: %s',
    (raw) => {
      expect(stringToInt(raw)).toBeNaN();
    }
  );
});

describe('toIntIndex', () => {
  // A hand-rolled `_set` reads its family's index with a bare
  // `path.get_slicec('/', 1).to_int()` (chain_ik_3d.cpp:37,
  // bone_twist_disperser_3d.cpp:37, spring_bone_simulator_3d.cpp:42), so the
  // index it acts on is whatever `to_int` resolves.
  it.each([
    ['x', 0],
    ['a1b2', 12],
    ['a-1', -1],
    ['-0-1', 1],
    ['12.9', 12],
  ])('resolves a non-integer spelling the way to_int does: %s', (raw, expected) => {
    expect(toIntIndex(raw)).toBe(expected);
  });

  it.each([
    ['0', 0],
    ['+7', 7],
    ['007', 7],
    ['-3', -3],
  ])('reads a clean is_valid_int spelling as itself: %s', (raw, expected) => {
    expect(toIntIndex(raw)).toBe(expected);
  });

  // Past 2^53 no double IS the int64 the text states, so this is not an
  // exactness claim: the SIGN is the only thing a negative-index guard asks,
  // and it survives here where `stringToInt` gives up.
  it('keeps the sign of an integer no double spells', () => {
    expect(toIntIndex('-9223372036854775808')).toBeLessThan(0);
    expect(toIntIndex('9223372036854775807')).toBeGreaterThan(0);
  });

  // Neither reader can name it — `is_valid_int` refuses the spelling and
  // `stringToInt` refuses the magnitude — so every comparison stays false.
  it('reads text that is neither as NaN', () => {
    expect(toIntIndex('a-9223372036854775808')).toBeNaN();
  });
});
