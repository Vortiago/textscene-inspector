import type { Less } from './sortArray.js';

/** `Span::bisect` (span.h:198): the first index `value` may go to, before or after equal elements. */
export function bisect<T>(elements: readonly T[], value: T, isBefore: boolean, less: Less<T>): number {
  let [low, high] = [0, elements.length];
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const goesRight = isBefore ? less(elements[middle]!, value) : !less(value, elements[middle]!);
    if (goesRight) low = middle + 1;
    else high = middle;
  }
  return low;
}
