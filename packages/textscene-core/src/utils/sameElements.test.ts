import { describe, expect, it } from 'vitest';
import { sameElements } from './sameElements';

describe('sameElements', () => {
  it('holds for equal lists', () => {
    expect(sameElements(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('holds for two empty lists', () => {
    expect(sameElements([], [])).toBe(true);
  });

  it('fails for lists of different length', () => {
    expect(sameElements(['a'], ['a', 'b'])).toBe(false);
  });

  it('fails for the same elements in another order', () => {
    expect(sameElements(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('compares objects by identity', () => {
    expect(sameElements([{}], [{}])).toBe(false);
  });
});
