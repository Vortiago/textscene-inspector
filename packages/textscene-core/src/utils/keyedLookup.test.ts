import { describe, expect, it } from 'vitest';
import { firstIndexWith, firstWith, lastWith } from './keyedLookup.js';
import { countedTable } from '../resources/testing/countedTable.js';

interface Entry {
  readonly id: string;
}

const entries = (...ids: string[]): Entry[] => ids.map((id) => ({ id }));
const idOf = (entry: Entry) => entry.id;

describe('firstWith', () => {
  const firstWithId = firstWith(idOf);

  it('finds the first entry carrying a repeated key', () => {
    const table = entries('a', 'b', 'a');
    expect(firstWithId(table, 'a')).toBe(table[0]);
  });

  it('finds nothing for a key no entry carries (edge case)', () => {
    expect(firstWithId(entries('a'), 'z')).toBeUndefined();
  });

  it('reads each entry once however many lookups it answers', () => {
    const { table, entryReads } = countedTable(entries(...Array.from({ length: 500 }, (_, i) => `id${i}`)));
    for (let i = 0; i < 500; i++) firstWithId(table, `id${i}`);
    expect(entryReads()).toBe(table.length);
  });
});

describe('lastWith', () => {
  it('finds the last entry carrying a repeated key', () => {
    const table = entries('a', 'b', 'a');
    expect(lastWith(idOf)(table, 'a')).toBe(table[2]);
  });
});

describe('firstIndexWith', () => {
  it('finds the index of the first entry carrying a repeated key', () => {
    expect(firstIndexWith(idOf)(entries('b', 'a', 'a'), 'a')).toBe(1);
  });
});
