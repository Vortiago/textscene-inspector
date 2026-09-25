/**
 * Bounded LRU cache over a `Map`. It evicts the least-recently-used entry past
 * `maxEntries` and calls `onEvict` so the caller can dispose a THREE texture,
 * material or geometry before the reference drops. A pinned entry is never evicted.
 */
export class LRUCache<V> {
  private readonly map = new Map<string, V>();
  /** Pins track mounted consumers, so `delete` and `clear` keep them: a hot-reload re-sets the key under the same consumer. */
  private readonly pins = new Map<string, number>();
  /** The (at most one) value per key replaced while pinned, awaiting release. */
  private readonly deferredDisposals = new Map<string, V>();
  /**
   * Count of keys in `map` with a nonzero pin count, so `evictOverflow` bails in
   * O(1) when nothing is evictable. Without it, pinned entries past `maxEntries`
   * made every `set()` walk the map (O(N²) over N loads). It counts the pinned keys
   * because eviction only removes zero-pin keys, so the loop needs no bookkeeping.
   */
  private pinnedInMap = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly onEvict?: (key: string, value: V) => void
  ) {}

  has(key: string): boolean {
    return this.map.has(key);
  }

  /** Delete-then-reinsert moves the key to the end of `Map` order, so `keys().next()` is the LRU entry. */
  get(key: string): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    const existing = this.map.get(key);
    if (!this.map.has(key) && this.isPinned(key)) this.pinnedInMap++;
    this.map.delete(key);
    this.map.set(key, value);
    // A real replacement, not a re-set of the identical value, disposes the old
    // value like any other removal, or it leaks what that value owned.
    if (existing !== undefined && !Object.is(existing, value)) {
      this.disposeOrDefer(key, existing);
    }
    this.evictOverflow(key);
  }

  delete(key: string): boolean {
    if (!this.map.has(key)) return false;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    if (this.isPinned(key)) this.pinnedInMap--;
    this.disposeOrDefer(key, value);
    return true;
  }

  clear(): void {
    for (const [key, value] of this.map) {
      this.disposeOrDefer(key, value);
    }
    this.map.clear();
    this.pinnedInMap = 0;
  }

  get size(): number {
    return this.map.size;
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }

  keys(): IterableIterator<string> {
    return this.map.keys();
  }

  /**
   * Increment the pin count for `key`. While count > 0, `evictOverflow` does not
   * evict this entry. A key not yet in the cache stores the count, honoured once
   * the key is set.
   */
  pin(key: string): void {
    const count = this.pins.get(key) ?? 0;
    if (count === 0 && this.map.has(key)) this.pinnedInMap++;
    this.pins.set(key, count + 1);
  }

  /**
   * Decrement the pin count for `key`, clamped at zero. It does not dispose or
   * remove the entry, which becomes eligible for LRU eviction on the next overflow.
   * Reaching zero flushes a disposal that a `set`, `delete` or `clear` deferred.
   */
  unpin(key: string): void {
    const count = this.pins.get(key) ?? 0;
    if (count <= 1) {
      if (count === 1 && this.map.has(key)) this.pinnedInMap--;
      this.pins.delete(key);
      this.flushDeferredDisposal(key);
    } else {
      this.pins.set(key, count - 1);
    }
  }

  private isPinned(key: string): boolean {
    return (this.pins.get(key) ?? 0) > 0;
  }

  /**
   * The one owner of disposal on removal, for a replacing `set`, `delete` and
   * `clear`: dispose `value` now when the key is unpinned, or defer it while a
   * mounted consumer may still hold it. A disposed value under a consumer is a
   * dead resource.
   */
  private disposeOrDefer(key: string, value: V): void {
    if (this.isPinned(key)) {
      // One deferred value per key: an older pending value was superseded a
      // replace-cycle ago (consumers re-read on `loaded`), so it goes now rather than
      // at unmount. A consumer that has not re-rendered between two removals in one
      // React batch briefly holds the disposed value.
      const prior = this.deferredDisposals.get(key);
      const current = this.map.get(key);
      if (
        prior !== undefined &&
        !Object.is(prior, value) &&
        !(current !== undefined && Object.is(prior, current))
      ) {
        this.onEvict?.(key, prior);
      }
      this.deferredDisposals.set(key, value);
    } else {
      this.onEvict?.(key, value);
    }
  }

  /**
   * Dispose the value removed while `key` was pinned, now that no consumer holds it.
   * It skips a value that is `Object.is` the key's current value (re-set, so live again).
   */
  private flushDeferredDisposal(key: string): void {
    if (!this.deferredDisposals.has(key)) return;
    const pending = this.deferredDisposals.get(key) as V;
    this.deferredDisposals.delete(key);
    const current = this.map.get(key);
    if (current !== undefined && Object.is(pending, current)) return;
    this.onEvict?.(key, pending);
  }

  /**
   * Evict LRU zero-pin entries until the cache is within `maxEntries`, disposing
   * directly since none is pinned. `justSet` is never a candidate on its own
   * insertion: when every other entry is pinned, the cache grows past `maxEntries`
   * and shrinks back as pins release. Deleting the visited key mid-iteration is safe.
   */
  private evictOverflow(justSet: string): void {
    if (this.map.size <= this.maxEntries) return;
    const candidates =
      this.map.size - this.pinnedInMap - (this.isPinned(justSet) ? 0 : 1);
    if (candidates <= 0) return;
    for (const key of this.map.keys()) {
      if (this.map.size <= this.maxEntries) return;
      if (key === justSet || this.isPinned(key)) continue;
      const value = this.map.get(key) as V;
      this.map.delete(key);
      this.onEvict?.(key, value);
    }
  }
}
