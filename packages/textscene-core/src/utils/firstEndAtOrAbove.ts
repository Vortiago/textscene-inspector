/** Binary search for the first of `count` ascending entries whose end is at or above `target`. */
export function firstEndAtOrAbove(count: number, endAt: (index: number) => number, target: number): number {
  let low = 0;
  let high = count;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (endAt(middle) < target) low = middle + 1;
    else high = middle;
  }
  return low;
}
