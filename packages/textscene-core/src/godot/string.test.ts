import { describe, it, expect } from 'vitest';
import {
  IS_VALID_INT_RE,
  literalText,
  simplifyResPath,
  splitTopLevel,
  STRING_LITERAL_SOURCE,
  stringToFloat,
  stringToInt,
} from './string.js';

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

  // The contents are what `set_animation` compares, so whitespace inside the
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

describe('STRING_LITERAL_SOURCE', () => {
  const firstLiteral = (text: string) => new RegExp(STRING_LITERAL_SOURCE).exec(text)?.[0];

  it('matches a plain string literal whole', () => {
    expect(firstLiteral('"idle"')).toBe('"idle"');
    expect(firstLiteral('""')).toBe('""');
  });

  it('runs past an escaped quote to the next unescaped one', () => {
    expect(firstLiteral('"Say \\"hi\\"", "next"')).toBe('"Say \\"hi\\""');
  });

  it('ends at a quote that follows an escaped backslash', () => {
    expect(firstLiteral('"a\\\\", "b"')).toBe('"a\\\\"');
  });

  it('takes a backslash before a raw newline as one escape', () => {
    expect(firstLiteral('"a\\\nb"')).toBe('"a\\\nb"');
  });

  it('matches nothing in a string that never closes', () => {
    expect(firstLiteral('"never closes')).toBeUndefined();
    expect(firstLiteral('"a\\"')).toBeUndefined();
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

describe('simplifyResPath', () => {
  /**
   * Godot rebuilds the part after a `scheme://` drive from its non-empty parts (`core/string/ustring.cpp:4152-4210`).
   * Measured against the engine: `res:///a/b.png`, `res:////a/b.png` and `res://a//b.png` all simplify to
   * `res://a/b.png`. A path left uncollapsed resolves to nothing.
   */
  it('collapses a run of slashes after the scheme', () => {
    expect(simplifyResPath('res:///a/b.png')).toBe('res://a/b.png');
    expect(simplifyResPath('res:////a/b.png')).toBe('res://a/b.png');
    expect(simplifyResPath('res://a//b.png')).toBe('res://a/b.png');
  });

  it('leaves an already-simple path exactly as it is', () => {
    expect(simplifyResPath('res://a/b.png')).toBe('res://a/b.png');
    expect(simplifyResPath('res://')).toBe('res://');
  });

  it('passes through text carrying no scheme', () => {
    expect(simplifyResPath('a/b.png')).toBe('a/b.png');
    expect(simplifyResPath('')).toBe('');
  });

  // `p > 0` and the all-alphanumeric check (`:4159-4167`): `://foo` has no
  // drive, so nothing is split off it.
  it('needs a non-empty alphanumeric scheme before the separator', () => {
    expect(simplifyResPath('://a//b')).toBe('://a//b');
    expect(simplifyResPath('re-s://a//b')).toBe('re-s://a//b');
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
    expect(stringToInt('+7')).toBe(7);
  });

  it('reads `-0` as the one zero the engine holds', () => {
    expect(Object.is(stringToInt('-0'), 0)).toBe(true);
  });

  // `_to_int` has no early exit for a character it cannot use: it skips it and
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
  // (ustring.cpp:2291-2292): the sign is not a leading-position rule. It is a
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
  // never scanned: a shorter scan, not truncation of a parsed float.
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
});

/**
 * The `int` an index lands in (`property_list_helper.cpp:57`) keeps the low 32 bits of the int64
 * `to_int()` returns. Each expected value comes from the engine rule, worked by hand.
 */
describe('stringToInt narrowed into an int', () => {
  it.each([
    ['4294967296', 0],
    ['4294967297', 1],
    ['2147483647', 2147483647],
    ['2147483648', -2147483648],
    ['-2147483648', -2147483648],
    ['-2147483649', 2147483647],
  ])('keeps the low 32 bits of %s', (raw, expected) => {
    expect(stringToInt(raw)).toBe(expected);
  });

  // `if (unlikely(digits > 18))` (ustring.cpp:2282) tests from the 20th digit, and the overflow
  // returns INT64_MAX or INT64_MIN (:2283-2284). INT64_MAX keeps 0xFFFFFFFF, which is -1, and
  // INT64_MIN keeps 0.
  it.each([
    ['99999999999999999999', -1],
    ['9999999999999999999999', -1],
    ['-99999999999999999999', 0],
    ['-9999999999999999999999', 0],
    ['a99999999999999999999', -1],
  ])('saturates a run of 20 or more digits: %s', (raw, expected) => {
    expect(stringToInt(raw)).toBe(expected);
  });

  // No test runs at the 19th digit, so `int64_t(integer)` (:2297) wraps a 19-digit value past
  // INT64_MAX: `9999999999999999999` is -8446744073709551617, whose low 32 bits are -1981284353.
  // Negated through `integer * uint64_t(-1)` (:2299), it is +8446744073709551617.
  it.each([
    ['9999999999999999999', -1981284353],
    ['-9999999999999999999', 1981284353],
    ['9223372036854775808', 0],
    ['-9223372036854775809', -1],
  ])('wraps a 19-digit value past INT64_MAX rather than saturating it: %s', (raw, expected) => {
    expect(stringToInt(raw)).toBe(expected);
  });

  // The overflow test at the 20th digit compares against `INT64_MAX / 10` and the last digit
  // (:2283): `7` still fits a positive value, and `8` a negative one.
  it.each([
    ['09223372036854775807', -1],
    ['09223372036854775808', -1],
    ['-09223372036854775808', 0],
    ['-09223372036854775809', 0],
  ])('reads INT64_MAX and INT64_MIN at the overflow boundary: %s', (raw, expected) => {
    expect(stringToInt(raw)).toBe(expected);
  });

  // `uint8_t digits` (:2275) wraps to 0 after 255 digits, so 19 digits go untested and the
  // `uint64_t` total wraps modulo 2^64: 250 zeros and 25 nines leave (10^25 - 1) mod 2^64,
  // 1590897978359414783, whose low 32 bits are 1241513983.
  it('follows the digit counter past its uint8 wrap', () => {
    expect(stringToInt(`${'0'.repeat(250)}${'9'.repeat(25)}`)).toBe(1241513983);
  });
});

/** `skeleton_3d.cpp:82` stores the index in a `uint32_t which`. */
describe('stringToInt narrowed into a uint32_t', () => {
  it.each([
    ['-1', 4294967295],
    ['a-1', 4294967295],
    ['4294967296', 0],
    ['2147483648', 2147483648],
    ['9999999999999999999', 2313682943],
    ['99999999999999999999', 4294967295],
    ['-99999999999999999999', 0],
  ])('keeps the low 32 bits of %s unsigned', (raw, expected) => {
    expect(stringToInt(raw, 'uint32')).toBe(expected);
  });
});

/**
 * The reader is total: whatever the text, the result is an integer the slot holds. A rule may then
 * skip a negative index with `index < 0`, as no NaN can reach the comparison.
 */
describe('stringToInt is total over its slot', () => {
  const pieces = ['', '0', '7', '9', '-', '+', 'x', '.', '/', ' '];
  const spellings = [
    ...pieces.flatMap((a) => pieces.flatMap((b) => pieces.map((c) => `${a}${b}${c}`))),
    ...[18, 19, 20, 21, 64, 300].flatMap((length) => [
      '9'.repeat(length),
      `-${'9'.repeat(length)}`,
      `a-${'8'.repeat(length)}`,
      `${'0'.repeat(length)}1`,
    ]),
  ];

  it.each([
    ['int32', -2147483648, 2147483647],
    ['uint32', 0, 4294967295],
  ] as const)('returns a %s for every spelling', (width, low, high) => {
    const outside = spellings.filter((text) => {
      const value = stringToInt(text, width);
      return !Number.isSafeInteger(value) || value < low || value > high || Object.is(value, -0);
    });
    expect(outside).toEqual([]);
  });
});
