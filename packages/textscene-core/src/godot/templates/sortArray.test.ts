/**
 * The sort against Godot 4.6.3: `sortArray.godot.json` holds the order `Array.sort_custom`, which
 * runs `SortArray`, left items in when sorted by a key alone, so equal keys show its instability.
 */
import { describe, expect, it } from 'vitest';
import measured from './sortArray.godot.json';
import { sortArray } from './sortArray';

type Item = { key: number; index: number };

const byKey = (a: Item, b: Item) => a.key < b.key;

/** The input index of each item, after sorting `keys` by key alone. */
function sortedIndices(keys: readonly number[]): number[] {
  const items = keys.map((key, index) => ({ key, index }));
  sortArray(items, byKey);
  return items.map(({ index }) => index);
}

describe('sortArray', () => {
  it('sorts by the comparator', () => {
    const numbers = [5, 3, 9, 1, 7];
    sortArray(numbers, (a, b) => a < b);
    expect(numbers).toEqual([1, 3, 5, 7, 9]);
  });

  it('keeps equal items in input order up to 16 items, where it is an insertion sort', () => {
    expect(sortedIndices([1, 0, 1, 0, 1, 0])).toEqual([1, 3, 5, 0, 2, 4]);
  });

  it("reorders equal items above 16 items as Godot's introsort does", () => {
    const { keys, order } = measured.twentyItemsTwoKeys;
    expect(sortedIndices(keys)).toEqual(order);
  });

  it("reorders equal items past the depth limit as Godot's heap sort does", () => {
    const { keys, order } = measured.organPipe2000;
    expect(sortedIndices(keys)).toEqual(order);
  });

  it('leaves an empty array empty (edge case)', () => {
    const empty: number[] = [];
    sortArray(empty, (a, b) => a < b);
    expect(empty).toEqual([]);
  });
});
