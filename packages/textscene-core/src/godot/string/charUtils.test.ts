import { describe, expect, it } from 'vitest';
import { isValidAsciiIdentifier, isWhitespace } from './charUtils.js';

describe('isWhitespace', () => {
  it('takes a space, a tab and a line feed', () => {
    expect([' ', '\t', '\n'].map(isWhitespace)).toEqual([true, true, true]);
  });

  it('refuses a letter and the empty string', () => {
    expect([isWhitespace('a'), isWhitespace('')]).toEqual([false, false]);
  });

  it('takes the Unicode spaces Godot lists, up to the zero-width space', () => {
    expect([' ', '​', '　', '\u0085'].map(isWhitespace)).toEqual([true, true, true, true]);
    expect(isWhitespace('‌')).toBe(false);
  });
});

describe('isValidAsciiIdentifier', () => {
  it('takes letters, digits and underscores', () => {
    expect(isValidAsciiIdentifier('_a1')).toBe(true);
  });

  it('refuses a leading digit and the empty string', () => {
    expect([isValidAsciiIdentifier('1a'), isValidAsciiIdentifier('')]).toEqual([false, false]);
  });

  it('refuses a letter outside ASCII', () => {
    expect(isValidAsciiIdentifier('é')).toBe(false);
  });
});
