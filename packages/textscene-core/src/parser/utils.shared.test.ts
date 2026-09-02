/**
 * Shared string helpers used by both parsers (lenient TscnParserCore + strict
 * StrictTscnParser) so they agree on string termination, and by node parsers
 * for unquoting/escape-decoding. Covers the escaped-quote edge cases the
 * docs-grill flagged (\" escaped, \\" = escaped backslash + real terminator).
 */

import { describe, expect, it } from 'vitest';
import {
  isIncompleteValue,
  unquoteString,
} from './utils';

describe('isIncompleteValue', () => {
  it('flags an open string', () => {
    expect(isIncompleteValue('"Field Notes')).toBe(true);
    expect(isIncompleteValue('"closed"')).toBe(false);
  });
  it('flags a value with more open brackets than close (spans more lines)', () => {
    expect(isIncompleteValue('[{')).toBe(true); // SpriteFrames `animations = [{` first line
    expect(isIncompleteValue('"frames": [{')).toBe(true);
    expect(isIncompleteValue('animations = [')).toBe(true);
  });
  it('accepts a balanced single-line array/dict', () => {
    expect(isIncompleteValue('[1, 2, 3]')).toBe(false);
    expect(isIncompleteValue('Rect2(0, 0, 16, 16)')).toBe(false);
    expect(isIncompleteValue('[{"a": 1}]')).toBe(false);
  });
  it('accepts the full accumulated SpriteFrames value as complete', () => {
    expect(
      isIncompleteValue('[{"frames": [{"texture": ExtResource("2")}], "name": &"right"}]')
    ).toBe(false);
  });
  it('ignores brackets inside strings', () => {
    expect(isIncompleteValue('"a [ b { c"')).toBe(false);
  });
});

describe('unquoteString', () => {
  it('strips surrounding quotes', () => {
    expect(unquoteString('"hello"')).toBe('hello');
  });
  it('passes through unquoted values', () => {
    expect(unquoteString('SubResource("x")')).toBe('SubResource("x")');
  });
  it('decodes \\n, \\t, \\r, \\\\, \\"', () => {
    expect(unquoteString('"a\\nb"')).toBe('a\nb');
    expect(unquoteString('"a\\tb"')).toBe('a\tb');
    expect(unquoteString('"a\\\\b"')).toBe('a\\b');
    expect(unquoteString('"say \\"hi\\""')).toBe('say "hi"');
  });
  it('decodes \\uXXXX / \\UXXXXXX Unicode escapes', () => {
    expect(unquoteString('"music \\u266a"')).toBe('music ♪'); // ♪
    expect(unquoteString('"emoji \\U01F600"')).toBe('emoji \u{1F600}'); // 😀
  });
  // `variant_parser.cpp:299-300` and `:308-309`: `case 'b': res = 8` and
  // `case 'f': res = 12`; `:350-351` `default: res = next` passes any other
  // escaped character through as itself.
  it('decodes \\b and \\f, and passes an unknown escape through as the character', () => {
    expect(unquoteString('"\\b"')).toBe('\b');
    expect([...unquoteString('"\\b"')]).toHaveLength(1);
    expect(unquoteString('"\\f"')).toBe('\f');
    expect(unquoteString('"It\\\'s"')).toBe("It's");
    expect(unquoteString('"a\\/b"')).toBe('a/b');
  });
  // `variant_parser.cpp:263-265` tokenizes `&"…"` and `@"…"` as a StringName,
  // and `variant.cpp:582-587` lists STRING_NAME as a strict source for STRING,
  // so the jacket reaches the setter as its text.
  it('strips the StringName jacket in both spellings', () => {
    expect(unquoteString('&"Hello"')).toBe('Hello');
    expect(unquoteString('@"Hello"')).toBe('Hello');
    expect(unquoteString('&"a\\nb"')).toBe('a\nb');
  });
  it('treats an escaped backslash before u as literal (\\\\u1234 → \\u1234)', () => {
    expect(unquoteString('"a\\\\u1234"')).toBe('a\\u1234');
  });
  it('leaves a \\UXXXXXX escape past the Unicode maximum undecoded', () => {
    // Six hex digits reach 0xFFFFFF; String.fromCodePoint throws above
    // 0x10FFFF, and one such literal would abort the whole scene parse.
    expect(unquoteString('"x \\U110000 y"')).toBe('x \\U110000 y');
    expect(unquoteString('"x \\U10FFFF y"')).toBe('x \u{10FFFF} y');
  });
});
