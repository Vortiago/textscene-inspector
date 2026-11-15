import { describe, expect, it } from 'vitest';
import { wildcardMatchNoCase } from './wildcard';

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
