/** The count of the entries of `ascending` at or below `value`, by binary search. */
export function countAtOrBelow(ascending: readonly number[], value: number): number {
  let low = 0;
  let high = ascending.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (ascending[middle]! <= value) low = middle + 1;
    else high = middle;
  }
  return low;
}
