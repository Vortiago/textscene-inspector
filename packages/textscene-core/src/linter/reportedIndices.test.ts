/**
 * The two halves of one cap, what a message names and what the rule walks, and the spelling a
 * message names an index the file writes in.
 */

import { describe, expect, it } from 'vitest';
import {
  indicesPastCount,
  listIndices,
  listWrittenIndices,
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
    const pairs = new Map<string, readonly number[]>([
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
});

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
