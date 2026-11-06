import { describe, expect, it } from 'vitest';
import { reverseFrom } from './reverseFrom';

describe('reverseFrom', () => {
  it('reverses the items from an index and keeps the ones before it', () => {
    const items = [1, 2, 3, 4, 5];
    reverseFrom(items, 2);
    expect(items).toEqual([1, 2, 5, 4, 3]);
  });

  it('reverses more items than a call takes as arguments', () => {
    const items = Array.from({ length: 1_000_000 }, (_, i) => i);
    reverseFrom(items, 1);
    expect([items[0], items[1], items.at(-1)]).toEqual([0, 999_999, 1]);
  });
});
