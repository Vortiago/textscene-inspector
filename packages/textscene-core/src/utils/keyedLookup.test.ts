import { describe, expect, it } from 'vitest';
import { firstWith, lastWith } from './keyedLookup.js';

interface Entry {
  readonly id: string;
}

const entries = (...ids: string[]): Entry[] => ids.map((id) => ({ id }));

/** `ids` as a table that counts each read of an entry. */
function countedTable(ids: string[]): { table: Entry[]; reads: () => number } {
  const table = entries(...ids);
  let reads = 0;
  const counted = new Proxy(table, {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) reads++;
      return Reflect.get(target, property, receiver);
    },
  });
  return { table: counted, reads: () => reads };
}

describe('firstWith', () => {
  const firstWithId = firstWith((entry: Entry) => entry.id);

  it('finds the index of the first entry carrying a repeated key', () => {
    expect(firstWithId(entries('a', 'b', 'a'), 'a')).toBe(0);
  });

  it('finds nothing for a key no entry carries (edge case)', () => {
    expect(firstWithId(entries('a'), 'z')).toBeUndefined();
  });

  it('reads each entry once however many lookups it answers', () => {
    const { table, reads } = countedTable(Array.from({ length: 500 }, (_, i) => `id${i}`));
    for (let i = 0; i < 500; i++) firstWithId(table, `id${i}`);
    expect(reads()).toBe(table.length);
  });
});

describe('lastWith', () => {
  it('finds the index of the last entry carrying a repeated key', () => {
    const lastWithId = lastWith((entry: Entry) => entry.id);
    expect(lastWithId(entries('a', 'b', 'a'), 'a')).toBe(2);
  });
});
