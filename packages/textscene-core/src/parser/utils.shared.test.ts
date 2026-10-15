/**
 * String helpers both parsers share, so they agree on string termination, and node
 * parsers use for unquoting and escape decoding. Covers the escaped-quote edge cases:
 * \" is escaped, and \\" is an escaped backslash before a real terminator.
 */

import { describe, expect, it } from 'vitest';
import { stripLineComment, unquoteLiteral, unquoteString } from './utils';

describe('stripLineComment', () => {
  it('drops an unquoted `;` and the rest of the line — VariantParser skips to end of line (variant_parser.cpp:214)', () => {
    expect(stripLineComment('ambient = 0.50 ; bumped from 0.40')).toBe('ambient = 0.50 ');
    expect(stripLineComment('; whole line')).toBe('');
    expect(stripLineComment('scale = Vector2(2, 2)')).toBe('scale = Vector2(2, 2)');
  });
  it('keeps a `;` inside a string, escapes included', () => {
    expect(stripLineComment('text = "a; b" ; c')).toBe('text = "a; b" ');
    expect(stripLineComment('text = "a \\" ; b"')).toBe('text = "a \\" ; b"');
  });
  it('resumes inside an open string on a continuation line', () => {
    expect(stripLineComment('second; line"', true)).toBe('second; line"');
    expect(stripLineComment('second" ; comment', true)).toBe('second" ');
  });
  it('leaves `#` alone — it opens a colour literal, not a comment (variant_parser.cpp:241)', () => {
    expect(stripLineComment('color = #ff0000')).toBe('color = #ff0000');
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
  // `scanQuoted` decides where the string ends: in `"a\"` the last quote is escaped,
  // so the literal never closes and keeps its opening quote.
  it('strips no quotes from a literal whose trailing quote is escaped', () => {
    expect(unquoteString('"a\\"')).toBe('"a"');
  });
  it('strips the quotes when an escaped backslash precedes the closing one', () => {
    expect(unquoteString('"a\\\\"')).toBe('a\\');
  });
  it('decodes the escapes of text that arrives already out of its quotes', () => {
    expect(unquoteString('say \\"hi\\"')).toBe('say "hi"');
  });
});

describe('unquoteLiteral', () => {
  it('reads a string literal as a STRING slot does', () => {
    expect(unquoteLiteral('"GUI in 3D"')).toBe('GUI in 3D');
    // `c_escape_multiline` (`ustring.cpp:4493-4499`) escapes only `\` and `"`.
    expect(unquoteLiteral('"say \\"hi\\" to C:\\\\dir"')).toBe('say "hi" to C:\\dir');
    expect(unquoteLiteral('"a\\tb"')).toBe('a\tb');
    expect(unquoteLiteral('&"ui_accept"')).toBe('ui_accept');
  });
  it('keeps a raw newline, which the writer leaves unescaped', () => {
    expect(unquoteLiteral('"line one\nline two"')).toBe('line one\nline two');
  });
  it('reads an empty literal as the empty string', () => {
    expect(unquoteLiteral('""')).toBe('');
  });
  it('leaves every value that is not one string literal as written', () => {
    for (const value of ['0', '2.0', 'true', 'Vector3(1, 1, 1)', '[1, 2]', '"a" "b"', '']) {
      expect(unquoteLiteral(value), value).toBe(value);
    }
  });
  it('leaves the escapes inside a Dictionary to the literals that hold them', () => {
    const dictionary = '{"Mat \\"x\\"": {"path": "res://a\\\\b.tres"}}';
    expect(unquoteLiteral(dictionary)).toBe(dictionary);
  });
  it('leaves an unclosed literal as written', () => {
    expect(unquoteLiteral('"a\\"')).toBe('"a\\"');
    expect(unquoteLiteral('"')).toBe('"');
    expect(unquoteLiteral('"never closes')).toBe('"never closes');
  });
});
