import { describe, expect, it } from 'vitest';
import { withEntry } from './withEntry';

describe('withEntry', () => {
  it('adds an entry that arrives', () => {
    expect([...withEntry(new Map<string, number>(), 'stars', 1)]).toEqual([['stars', 1]]);
  });

  it('removes an entry that leaves', () => {
    expect(withEntry(new Map([['stars', 1]]), 'stars', undefined).size).toBe(0);
  });

  it('keeps the same map when nothing changes, so no render runs again (edge case)', () => {
    const map = new Map([['stars', 1]]);
    expect(withEntry(map, 'stars', 1)).toBe(map);
  });
});
