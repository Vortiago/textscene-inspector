/**
 * Godot's `SortArray::sort` (`core/templates/sort_array.h`): an introsort that falls back to a
 * heap sort past its depth limit, then an insertion sort. It is not stable above 16 items, so a
 * port must match it where two items compare equal, as two dictionary keys of an unordered type do.
 */

/** Whether `a` sorts before `b`, as a Godot comparator answers. */
export type Less<T> = (a: T, b: T) => boolean;

/** Godot's `INTROSORT_THRESHOLD`: a range this short or shorter goes to the insertion sort. */
const INTROSORT_THRESHOLD = 16;

/** Sorts `items` in place, in the order Godot's `SortArray::sort` leaves them. */
export function sortArray<T>(items: T[], less: Less<T>): void {
  if (items.length === 0) return;
  new Sorter(items, less).sort();
}

/** One sort's array and comparator, so each step of the port reads like Godot's. */
class Sorter<T> {
  constructor(
    private readonly items: T[],
    private readonly less: Less<T>
  ) {}

  sort(): void {
    const length = this.items.length;
    this.introsort(0, length, 2 * bitlog(length));
    this.finalInsertionSort(0, length);
  }

  private introsort(first: number, last: number, maxDepth: number): void {
    while (last - first > INTROSORT_THRESHOLD) {
      if (maxDepth === 0) {
        this.heapSort(first, last);
        return;
      }
      maxDepth--;
      const pivot = this.medianOf3Index(first, first + Math.trunc((last - first) / 2), last - 1);
      const cut = this.partition(first, last, pivot);
      this.introsort(cut, last, maxDepth);
      last = cut;
    }
  }

  private medianOf3Index(a: number, b: number, c: number): number {
    const { items, less } = this;
    if (less(items[a]!, items[b]!)) {
      if (less(items[b]!, items[c]!)) return b;
      return less(items[a]!, items[c]!) ? c : a;
    }
    if (less(items[a]!, items[c]!)) return a;
    return less(items[b]!, items[c]!) ? c : b;
  }

  /** `partitioner`: the pivot moves with its item when a swap takes it. */
  private partition(first: number, last: number, pivot: number): number {
    const { items, less } = this;
    while (true) {
      while (first !== pivot && less(items[first]!, items[pivot]!)) first++;
      last--;
      while (last !== pivot && less(items[pivot]!, items[last]!)) last--;
      if (first >= last) return first;
      if (pivot === first) pivot = last;
      else if (pivot === last) pivot = first;
      [items[first], items[last]] = [items[last]!, items[first]!];
      first++;
    }
  }

  /** `partial_sort` over the whole range, which is a heap sort. */
  private heapSort(first: number, last: number): void {
    this.makeHeap(first, last);
    for (let end = last; end - first > 1; end--) {
      this.popHeap(first, end - 1, end - 1, this.items[end - 1]!);
    }
  }

  private makeHeap(first: number, last: number): void {
    const length = last - first;
    if (length < 2) return;
    for (let parent = Math.trunc((length - 2) / 2); parent >= 0; parent--) {
      this.adjustHeap(first, parent, length, this.items[first + parent]!);
    }
  }

  private popHeap(first: number, last: number, result: number, value: T): void {
    this.items[result] = this.items[first]!;
    this.adjustHeap(first, 0, last - first, value);
  }

  private adjustHeap(first: number, hole: number, length: number, value: T): void {
    const { items, less } = this;
    const top = hole;
    let secondChild = 2 * hole + 2;
    while (secondChild < length) {
      if (less(items[first + secondChild]!, items[first + secondChild - 1]!)) secondChild--;
      items[first + hole] = items[first + secondChild]!;
      hole = secondChild;
      secondChild = 2 * (secondChild + 1);
    }
    if (secondChild === length) {
      items[first + hole] = items[first + secondChild - 1]!;
      hole = secondChild - 1;
    }
    this.pushHeap(first, hole, top, value);
  }

  private pushHeap(first: number, hole: number, top: number, value: T): void {
    const { items, less } = this;
    let parent = Math.trunc((hole - 1) / 2);
    while (hole > top && less(items[first + parent]!, value)) {
      items[first + hole] = items[first + parent]!;
      hole = parent;
      parent = Math.trunc((hole - 1) / 2);
    }
    items[first + hole] = value;
  }

  private finalInsertionSort(first: number, last: number): void {
    if (last - first <= INTROSORT_THRESHOLD) {
      this.insertionSort(first, last);
      return;
    }
    this.insertionSort(first, first + INTROSORT_THRESHOLD);
    for (let i = first + INTROSORT_THRESHOLD; i !== last; i++) this.unguardedLinearInsert(i, this.items[i]!);
  }

  private insertionSort(first: number, last: number): void {
    for (let i = first + 1; i < last; i++) this.linearInsert(first, i);
  }

  private linearInsert(first: number, last: number): void {
    const value = this.items[last]!;
    if (!this.less(value, this.items[first]!)) {
      this.unguardedLinearInsert(last, value);
      return;
    }
    this.items.copyWithin(first + 1, first, last);
    this.items[first] = value;
  }

  /** Needs an item before `last` that `value` does not sort before, so the walk stops. */
  private unguardedLinearInsert(last: number, value: T): void {
    const { items, less } = this;
    for (let next = last - 1; less(value, items[next]!); next--) {
      items[last] = items[next]!;
      last = next;
    }
    items[last] = value;
  }
}

/** `bitlog`: the floor of log2 of a positive length. */
function bitlog(length: number): number {
  return Math.floor(Math.log2(length));
}
