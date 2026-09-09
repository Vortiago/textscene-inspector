/**
 * The two halves of one cap: what a message NAMES, and what the rule WALKS.
 */

import { describe, expect, it } from 'vitest';
import { listIndices, unsatisfiedIndices } from './reportedIndices.js';

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

describe('unsatisfiedIndices', () => {
  it('lists the indices `satisfied` omits, and counts them all', () => {
    expect(unsatisfiedIndices(5, new Set([1, 3]))).toEqual({ listed: [0, 2, 4], total: 3 });
  });

  it('stops the walk at the cap while still counting the whole range', () => {
    // The assertion that matters is that this RETURNS. `setting_count` is an
    // int slot with no ceiling, so this value passes its own validator; the
    // predecessor built one entry per index and spent minutes and gigabytes
    // reaching a message it then truncated to 32 entries.
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
