/**
 * Minimal bounded LRU cache. A `Map` wrapper that evicts the
 * least-recently-used entry once `maxEntries` is exceeded, invoking an
 * optional `onEvict` hook so callers can release non-GC resources (dispose a
 * THREE texture/material/geometry) before the reference is dropped.
 *
 * Recency is tracked via `Map`'s insertion-order iteration: `get` and `set`
 * both delete-then-reinsert the key, which moves it to the end of the
 * iteration order, so `keys().next()` is always the least-recently-used
 * entry. `delete` and `clear` never invoke `onEvict` — those are explicit
 * caller-driven removals (hot-reload, corpus switch), not capacity eviction.
 */
export class LRUCache<V> {
  private readonly map = new Map<string, V>();

  constructor(
    private readonly maxEntries: number,
    private readonly onEvict?: (key: string, value: V) => void
  ) {}

  has(key: string): boolean {
    return this.map.has(key);
  }

  get(key: string): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    this.evictOverflow();
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
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

  private evictOverflow(): void {
    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      const oldestValue = this.map.get(oldestKey) as V;
      this.map.delete(oldestKey);
      this.onEvict?.(oldestKey, oldestValue);
    }
  }
}
