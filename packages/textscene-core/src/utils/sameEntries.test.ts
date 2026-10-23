import { describe, expect, it } from 'vitest';
import { sameEntries } from './sameEntries.js';

describe('sameEntries', () => {
  it('holds for two maps with the same keys and values', () => {
    expect(
      sameEntries(
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
        new Map([
          ['b', 2],
          ['a', 1],
        ])
      )
    ).toBe(true);
  });

  it('fails where a value differs', () => {
    expect(sameEntries(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false);
  });

  it('fails where the sizes differ', () => {
    expect(sameEntries(new Map([['a', 1]]), new Map())).toBe(false);
  });

  it('fails where a key differs and the value is undefined', () => {
    expect(sameEntries(new Map([['a', undefined]]), new Map([['b', undefined]]))).toBe(false);
  });
});
