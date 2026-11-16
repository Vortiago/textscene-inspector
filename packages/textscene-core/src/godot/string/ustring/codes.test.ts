import { describe, expect, it } from 'vitest';
import { codesOf, substr, textOf, UnrepresentableText } from './codes';

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
