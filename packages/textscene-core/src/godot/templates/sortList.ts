import { replaceAll } from './arrayWrite.js';
import type { Less } from './sortArray.js';

/** Sorts `items` in place as `SortList::sort` (sort_list.h) does for `HashMap::sort_custom`. */
export function sortList<T>(items: T[], less: Less<T>): void {
  if (items.length < 2) return;
  let sortedUntil = 0;
  while (sortedUntil < items.length - 1 && !less(items[sortedUntil + 1]!, items[sortedUntil]!)) sortedUntil++;
  if (sortedUntil === items.length - 1) return;
  const head = items.slice(0, sortedUntil + 1);
  const rest = mergeSort(items.slice(sortedUntil + 1), less);
  replaceAll(items, merge(head, rest, less));
}

/** `_merge_sort`: `_get_mid` puts the middle item at the end of the first half. */
function mergeSort<T>(items: T[], less: Less<T>): T[] {
  if (items.length === 1) return items;
  let [end, middle] = [0, 0];
  while (end + 2 < items.length) {
    end += 2;
    middle++;
  }
  const first = mergeSort(items.slice(0, middle + 1), less);
  const second = mergeSort(items.slice(middle + 1), less);
  return merge(first, second, less);
}

/** `_merge`: an item of the second run goes first only when it sorts before the first run's item. */
function merge<T>(first: readonly T[], second: readonly T[], less: Less<T>): T[] {
  const merged: T[] = [];
  let [i, j] = [0, 0];
  while (i < first.length && j < second.length)
    merged.push(less(second[j]!, first[i]!) ? second[j++]! : first[i++]!);
  return [...merged, ...first.slice(i), ...second.slice(j)];
}
