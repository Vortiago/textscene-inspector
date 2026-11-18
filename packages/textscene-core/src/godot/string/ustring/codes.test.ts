import { describe, expect, it } from 'vitest';
import { append, codesOf, substr, textOf, UnrepresentableText } from './codes';

describe('textOf', () => {
  it('spells the codes of a text back', () => {
    expect(textOf(codesOf('a😀\ud800'))).toBe('a😀\ud800');
  });

  it('refuses a code past U+10FFFF', () => {
    expect(() => textOf([0x110000])).toThrow(UnrepresentableText);
  });

  it('refuses two surrogates in a row, which would read back as one code', () => {
    expect(() => textOf([0xd83d, 0xde00])).toThrow(UnrepresentableText);
  });
});

describe('substr', () => {
  it('runs to the end for a count of -1, and is empty outside the text', () => {
    expect(substr([1, 2, 3], 1)).toEqual([2, 3]);
    expect(substr([1, 2, 3], 3)).toEqual([]);
    expect(substr([1, 2, 3], -1, 2)).toEqual([]);
  });
});

describe('append', () => {
  it('adds the codes of each part to the end of the target, and returns the target', () => {
    const target = [1];
    expect(append(target, [2, 3], [4])).toBe(target);
    expect(target).toEqual([1, 2, 3, 4]);
  });

  it('leaves the target as it is for no parts or empty parts (edge case)', () => {
    expect(append([1], [], [])).toEqual([1]);
  });

  it('appends a part of a million codes, which a spread into one push cannot (edge case)', () => {
    expect(append([], new Array<number>(1_000_000).fill(65))).toHaveLength(1_000_000);
  });
});
