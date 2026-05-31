/**
 * Shared string helpers used by both parsers (lenient TscnParserCore + strict
 * StrictTscnParser) so they agree on string termination, and by node parsers
 * for unquoting/escape-decoding. Covers the escaped-quote edge cases the
 * docs-grill flagged (\" escaped, \\" = escaped backslash + real terminator).
 */

import { describe, expect, it } from 'vitest';
import { countUnescapedQuotes, isUnterminatedString, unquoteString, intOr } from './utils';

describe('countUnescapedQuotes', () => {
  it('counts plain delimiters', () => {
    expect(countUnescapedQuotes('"abc"')).toBe(2);
    expect(countUnescapedQuotes('"abc')).toBe(1);
  });
  it('skips escaped quotes (\\")', () => {
    expect(countUnescapedQuotes('"say \\"hi\\""')).toBe(2); // inner quotes escaped
  });
  it('treats \\\\" as escaped-backslash + real quote', () => {
    // Raw value "path\\" → backslash is escaped, the final " is a real delimiter.
    expect(countUnescapedQuotes('"path\\\\"')).toBe(2);
  });
});

describe('isUnterminatedString', () => {
  it('flags an open string', () => {
    expect(isUnterminatedString('"Inspector Crawford')).toBe(true);
  });
  it('accepts a closed string', () => {
    expect(isUnterminatedString('"closed"')).toBe(false);
  });
  it('accepts a string ending in an escaped backslash (\\\\") as closed', () => {
    expect(isUnterminatedString('"path\\\\"')).toBe(false);
  });
  it('ignores non-string values', () => {
    expect(isUnterminatedString('Vector2(1, 2)')).toBe(false);
    expect(isUnterminatedString('42')).toBe(false);
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
  it('treats an escaped backslash before u as literal (\\\\u1234 → \\u1234)', () => {
    expect(unquoteString('"a\\\\u1234"')).toBe('a\\u1234');
  });
});

describe('intOr', () => {
  it('parses ints', () => {
    expect(intOr('3')).toBe(3);
  });
  it('returns undefined for absent/invalid', () => {
    expect(intOr(undefined)).toBeUndefined();
    expect(intOr('abc')).toBeUndefined();
  });
});
