/** Reverses the tail of an array in place, at any length. */

/**
 * Reverses `items[from..]` in place. A spread of the tail into `splice` passes each item as an
 * argument, which overflows the stack past about 125,000 items in V8.
 */
export function reverseFrom<T>(items: T[], from: number): void {
  for (let low = from, high = items.length - 1; low < high; low++, high--) {
    const item = items[low]!;
    items[low] = items[high]!;
    items[high] = item;
  }
}
