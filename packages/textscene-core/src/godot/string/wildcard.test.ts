import { describe, expect, it } from 'vitest';
import { wildcardMatch, wildcardMatchNoCase } from './wildcard';

describe('wildcardMatchNoCase', () => {
  it('matches `*` against any run, a dot included', () => {
    expect(wildcardMatchNoCase('a.b.png', '*.png')).toBe(true);
    expect(wildcardMatchNoCase('a.txt', '*.png')).toBe(false);
  });

  it('matches `*` against an empty run', () => {
    expect(wildcardMatchNoCase('.png', '*.png')).toBe(true);
  });

  it('ignores case', () => {
    expect(wildcardMatchNoCase('PICTURE.PNG', '*.png')).toBe(true);
  });

  // Measured in Godot 4.6.3 (`fileListOracle`, case "wildcard_filter"): `file-?.png` lists `file-2.png` only.
  it('matches `?` against one character that is not a dot', () => {
    expect(wildcardMatchNoCase('file-2.png', 'file-?.png')).toBe(true);
    expect(wildcardMatchNoCase('file-10.png', 'file-?.png')).toBe(false);
    expect(wildcardMatchNoCase('file..png', 'file-?png')).toBe(false);
    expect(wildcardMatchNoCase('a.png', 'a?png')).toBe(false);
  });

  it('matches nothing for an empty text or an empty pattern', () => {
    expect(wildcardMatchNoCase('', '*')).toBe(false);
    expect(wildcardMatchNoCase('a', '')).toBe(false);
  });
});

/** `_wildcard_match` (ustring.cpp:3524) as Godot writes it, recursive, for short texts only. */
function recursiveMatch(pattern: string, text: string): boolean {
  if (pattern === '') return text === '';
  const [wildcard, rest] = [pattern[0], pattern.slice(1)];
  if (wildcard === '*')
    return recursiveMatch(rest, text) || (text !== '' && recursiveMatch(pattern, text.slice(1)));
  if (text === '') return false;
  if (wildcard === '?') return text[0] !== '.' && recursiveMatch(rest, text.slice(1));
  return text[0] === wildcard && recursiveMatch(rest, text.slice(1));
}

describe('wildcardMatch', () => {
  it("answers as Godot's recursion does for every short text and pattern", () => {
    const words = (length: number, alphabet: string): string[] =>
      length === 0 ? [''] : words(length - 1, alphabet).flatMap((word) => [...alphabet].map((c) => word + c));
    const texts = [1, 2, 3, 4].flatMap((length) => words(length, 'ab.'));
    const patterns = [1, 2, 3, 4].flatMap((length) => words(length, 'a.*?'));
    for (const pattern of patterns)
      for (const text of texts) expect(wildcardMatch(text, pattern)).toBe(recursiveMatch(pattern, text));
  });

  it('matches a text longer than the JavaScript stack is deep', () => {
    const text = 'x'.repeat(200_000);
    expect(wildcardMatch(text, '*y')).toBe(false);
    expect(wildcardMatch(text, '*x')).toBe(true);
  });
});
