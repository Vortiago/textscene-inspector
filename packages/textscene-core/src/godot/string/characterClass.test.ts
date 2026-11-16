import { describe, expect, it } from 'vitest';
import {
  isUnicodeIdentifierContinue,
  isUnicodeIdentifierStart,
  isUnicodeLetter,
  isUnicodeLowerCase,
  isUnicodeUpperCase,
} from './characterClass.js';

describe('the character classes of char_range.inc', () => {
  it('starts an identifier with a letter or `_`, not a digit', () => {
    expect(['a', '_', 'é', '日', '1'].map(isUnicodeIdentifierStart)).toEqual([true, true, true, true, false]);
  });

  it('continues an identifier with a digit', () => {
    expect(isUnicodeIdentifierContinue('1')).toBe(true);
  });

  it('tells an upper-case letter from a lower-case one', () => {
    expect([0x41, 0x61, 0xc9, 0x30].map(isUnicodeUpperCase)).toEqual([true, false, true, false]);
    expect([0x41, 0x61, 0xe9, 0x30].map(isUnicodeLowerCase)).toEqual([false, true, true, false]);
  });

  it('counts a CJK ideograph as a letter of neither case', () => {
    expect([isUnicodeLetter(0x65e5), isUnicodeUpperCase(0x65e5), isUnicodeLowerCase(0x65e5)]).toEqual([
      true,
      false,
      false,
    ]);
  });
});
