/**
 * Shared string helpers used by both parsers (lenient TscnParserCore + strict
 * StrictTscnParser) so they agree on string termination, and by node parsers
 * for unquoting/escape-decoding. Covers the escaped-quote edge cases the
 * docs-grill flagged (\" escaped, \\" = escaped backslash + real terminator).
 */

import { describe, expect, it } from 'vitest';
import {
  countUnescapedQuotes,
  isUnterminatedString,
  isIncompleteValue,
  unquoteString,
} from './utils';

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

describe('isIncompleteValue', () => {
  it('flags an open string (like isUnterminatedString)', () => {
    expect(isIncompleteValue('"Inspector Crawford')).toBe(true);
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
  it('treats an escaped backslash before u as literal (\\\\u1234 → \\u1234)', () => {
    expect(unquoteString('"a\\\\u1234"')).toBe('a\\u1234');
  });
});
