import { describe, expect, it } from 'vitest';
import { isStringLess } from './stringOrder.js';

// Each expected answer is Godot 4.6.3's `<` of the same strings.
describe('isStringLess', () => {
  it('orders by code point', () => {
    expect([isStringLess('a', 'b'), isStringLess('Z', 'a')]).toEqual([true, true]);
  });

  it('orders the empty string first', () => {
    expect([isStringLess('', 'a'), isStringLess('a', '')]).toEqual([true, false]);
  });

  it('orders a prefix before the longer string', () => {
    expect([isStringLess('a', 'ab'), isStringLess('ab', 'a')]).toEqual([true, false]);
  });

  it('is false for equal strings', () => {
    expect(isStringLess('abc', 'abc')).toBe(false);
  });

  it('compares a code point above U+FFFF whole', () => {
    expect(isStringLess('\u{ffff}', '\u{1f600}')).toBe(true);
  });
});
