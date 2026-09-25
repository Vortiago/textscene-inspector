/**
 * The two halves of one cap, what a message names and what the rule walks, and the spelling a
 * message names an index the file writes in.
 */

import { describe, expect, it } from 'vitest';
import {
  indicesPastCount,
  listIndices,
  listWrittenIndices,
  negativeIndexError,
  unsatisfiedIndices,
  writtenIndex,
} from './reportedIndices.js';

describe('listIndices', () => {
  it('names every index while they fit', () => {
    expect(listIndices([0, 1, 2])).toBe('0, 1, 2');
  });

  it('names 32 and counts the rest', () => {
    const listed = listIndices(Array.from({ length: 40 }, (_, i) => i));
    expect(listed.startsWith('0, 1, 2')).toBe(true);
    expect(listed.endsWith('31 and 8 more')).toBe(true);
  });

  it('takes the remainder from `total` when the caller already capped', () => {
    // The walk stops at the cap, so its result cannot say how many it skipped.
    expect(listIndices([0, 1], 9_999)).toBe('0, 1 and 9,997 more');
  });
});

describe('listWrittenIndices', () => {
  it('names each text as written, ascending by the index it resolves to', () => {
    expect(listWrittenIndices(new Map([['10', 10], ['+2', 2], ['07', 7]]))).toBe('+2, 07, 10');
  });

  it('names what Godot stores beside a text that does not spell it', () => {
    expect(listWrittenIndices(new Map([['4294967297', 1]]))).toBe('4294967297 (stored as 1)');
  });

  it('orders several spellings of one index by the text, shorter first', () => {
    const written = new Map([
      ['4294967301', 5],
      ['+5', 5],
      ['5', 5],
    ]);
    expect(listWrittenIndices(written)).toBe('5, +5, 4294967301 (stored as 5)');
  });

  it('orders a nested key by each index position in turn', () => {
    // Numeric on both halves: a lexicographic sort puts `0/10` before `0/2`.
    const pairs = new Map<string, readonly [number, number]>([
      ['1/0', [1, 0]],
      ['0/10', [0, 10]],
      ['0/2', [0, 2]],
    ]);
    expect(listWrittenIndices(pairs)).toBe('0/2, 0/10, 1/0');
  });

  it('caps the list like listIndices', () => {
    const written = new Map(Array.from({ length: 40 }, (_, i) => [String(i), i] as const));
    expect(listWrittenIndices(written).endsWith('31 and 8 more')).toBe(true);
  });

  it('names the lowest indices past the cap, whatever order the keys arrive in', () => {
    const written = new Map(Array.from({ length: 40 }, (_, i) => [`+${39 - i}`, 39 - i] as const));
    const listed = listWrittenIndices(written);
    expect(listed.startsWith('+0, +1, ')).toBe(true);
    expect(listed.endsWith('+31 and 8 more')).toBe(true);
  });

  it('lists what a full sort puts first, for a large shuffled map', () => {
    // Three spellings per index, so the text tie-break decides as often as the index does.
    const entries = Array.from({ length: 5_000 }, (_, index) => [
      [String(index), index] as const,
      [`+${index}`, index] as const,
      [String(4294967296 + index), index] as const,
    ]).flat();
    shuffle(entries);
    const sorted = [...entries].sort(
      ([textA, a], [textB, b]) => a - b || textA.length - textB.length || compareText(textA, textB)
    );
    expect(listWrittenIndices(new Map(entries))).toBe(spellFirst(sorted, entries.length));
  });

  it('lists what a full sort puts first, for a large shuffled map of nested keys', () => {
    const entries = Array.from({ length: 5_000 }, (_, at) => {
      const pair = [at % 50, Math.floor(at / 50)] as const;
      return [`${pair[0]}/${pair[1]}`, pair] as const;
    });
    shuffle(entries);
    const sorted = [...entries].sort(
      ([textA, a], [textB, b]) =>
        a[0] - b[0] || a[1] - b[1] || textA.length - textB.length || compareText(textA, textB)
    );
    expect(listWrittenIndices(new Map(entries))).toBe(spellFirst(sorted, entries.length));
  });
});

/** A seeded Fisher-Yates shuffle, so a failure reproduces. */
function shuffle<T>(items: T[]): void {
  let seed = 1;
  const next = (): number => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (let at = items.length - 1; at > 0; at--) {
    const other = Math.floor(next() * (at + 1));
    [items[at], items[other]] = [items[other]!, items[at]!];
  }
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The capped list the first entries of a full sort spell. */
function spellFirst(
  sorted: readonly (readonly [string, number | readonly number[]])[],
  total: number
): string {
  return listIndices(
    sorted.slice(0, 32).map(([text, resolved]) => writtenIndex(text, resolved)),
    total
  );
}

describe('indicesPastCount', () => {
  it('maps each written index at or past the count to the index it resolves to', () => {
    expect(
      indicesPastCount(
        { item_count: '2', 'item_1/text': '"a"', 'item_2/text': '"b"', 'item_+3/icon': 'null' },
        'item_',
        'is_valid_int',
        2
      )
    ).toEqual(new Map([['2', 2], ['+3', 3]]));
  });

  it('leaves a negative index to the dispatcher that already reports it', () => {
    expect(indicesPastCount({ 'item_-4/text': '"a"' }, 'item_', 'is_valid_int', 0).size).toBe(0);
  });

  it('names one text once, whatever its leaves', () => {
    const past = indicesPastCount(
      { 'item_4294967299/text': '"a"', 'item_4294967299/icon': 'null' },
      'item_',
      'is_valid_int',
      2
    );
    expect(past).toEqual(new Map([['4294967299', 3]]));
  });

  // `int index = ….to_int()` (property_list_helper.cpp:57) keeps the low 32 bits.
  it('measures the index Godot stores, not the number the text spells', () => {
    expect(indicesPastCount({ 'item_4294967296/text': '"a"' }, 'item_', 'is_valid_int', 1).size).toBe(
      0
    );
  });
});

describe('writtenIndex', () => {
  it('names a text that spells the stored index as it is', () => {
    expect(writtenIndex('-1', -1)).toBe('-1');
  });

  it('names a padded or signed spelling as written', () => {
    expect(writtenIndex('+05', 5)).toBe('+05');
  });

  it('adds the stored index where the int narrows the text', () => {
    expect(writtenIndex('2147483648', -2147483648)).toBe('2147483648 (stored as -2147483648)');
  });

  it('adds the stored index where to_int reads text is_valid_int refuses', () => {
    expect(writtenIndex('a-1', -1)).toBe('a-1 (stored as -1)');
  });

  it('adds the stored pair where either half of a nested key differs', () => {
    expect(writtenIndex('0/4294967298', [0, 2])).toBe('0/4294967298 (stored as 0/2)');
  });

  it('names a nested key as written where both halves spell their index', () => {
    expect(writtenIndex('00/5', [0, 5])).toBe('00/5');
  });
});

describe('negativeIndexError', () => {
  const message = (index: string): string => `Index ${index} is negative`;

  it('returns null for an index Godot stores at or above zero', () => {
    expect(negativeIndexError('0', 'item_0/text', 3, message, 'NEGATIVE')).toBeNull();
  });

  it('refuses the key of a negative index, naming it as written', () => {
    expect(negativeIndexError('-2', 'item_-2/text', 3, message, 'NEGATIVE')).toEqual({
      severity: 'error',
      message: 'Index -2 is negative',
      line: 3,
      column: 'item_-2/text'.length + 3,
      code: 'NEGATIVE',
      keyVerdict: true,
    });
  });

  it('refuses a text the int wraps below zero, naming what Godot stores', () => {
    const error = negativeIndexError('2147483648', 'item_2147483648/text', 1, message, 'NEGATIVE');
    expect(error?.message).toBe('Index 2147483648 (stored as -2147483648) is negative');
  });

  it('reads the index as to_int does, so a sign after a non-digit counts', () => {
    const error = negativeIndexError('a-1', 'settings/a-1/bone', 1, message, 'NEGATIVE');
    expect(error?.message).toBe('Index a-1 (stored as -1) is negative');
  });
});

describe('unsatisfiedIndices', () => {
  it('lists the indices `satisfied` omits, and counts them all', () => {
    expect(unsatisfiedIndices(5, new Set([1, 3]))).toEqual({ listed: [0, 2, 4], total: 3 });
  });

  it('stops the walk at the cap while still counting the whole range', () => {
    // The assertion that matters is that this returns. `setting_count` is an
    // int slot with no ceiling, so this value passes its own validator, and a
    // walk of every index takes minutes and gigabytes.
    const { listed, total } = unsatisfiedIndices(2_147_483_647, new Set());
    expect(listed).toEqual(Array.from({ length: 32 }, (_, i) => i));
    expect(total).toBe(2_147_483_647);
  });

  it('walks past a satisfied prefix without listing it', () => {
    const satisfied = new Set(Array.from({ length: 100 }, (_, i) => i));
    expect(unsatisfiedIndices(2_147_483_647, satisfied).listed[0]).toBe(100);
  });

  it('counts nothing unsatisfied below zero', () => {
    // A negative count is its own validator's diagnostic and allocates nothing
    // in the engine, so it names no index here either.
    expect(unsatisfiedIndices(-4, new Set())).toEqual({ listed: [], total: 0 });
  });
});
