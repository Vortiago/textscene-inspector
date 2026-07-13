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
 * `set` DOES invoke `onEvict` for the value it replaces at an existing key
 * (distinct from `Object.is`-identical re-sets) — the reference to that old
 * value is dropped exactly as it would be on capacity eviction, so it gets
 * the same disposal guarantee rather than silently leaking.
 *
 * ## Reference counting (pin / unpin)
 *
 * `pin(key)` increments a per-entry reference count; `unpin(key)` decrements
 * it (clamped at zero). `evictOverflow` skips any entry whose count is > 0,
 * falling back to pure LRU among the zero-count entries only. If every entry
 * is pinned and capacity is exceeded, the cache temporarily grows beyond
 * `maxEntries` rather than disposing a resource that a mounted consumer still
 * holds — it evicts back down as pins are released.
 *
 * Unpin to zero does NOT eagerly dispose the entry; the entry remains in the
 * cache and is simply eligible for ordinary LRU eviction on the next
 * `set` that triggers overflow.
 */
export class LRUCache<V> {
  private readonly map = new Map<string, V>();
  private readonly pins = new Map<string, number>();

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
    const existing = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    // A real replacement — not a no-op re-set of the identical value — drops
    // the old reference exactly like capacity eviction does, so it gets the
    // same `onEvict` disposal instead of silently leaking whatever the old
    // value owned (a THREE texture/material/geometry).
    if (existing !== undefined && !Object.is(existing, value)) {
      this.onEvict?.(key, existing);
    }
    this.evictOverflow();
  }

  delete(key: string): boolean {
    this.pins.delete(key);
    return this.map.delete(key);
  }

  clear(): void {
    this.pins.clear();
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }

  /**
   * Increment the pin count for `key`. While count > 0, `evictOverflow`
   * will not evict this entry. Safe to call for a key not yet in the cache
   * (the count is stored and honoured once the key is set).
   */
  pin(key: string): void {
    this.pins.set(key, (this.pins.get(key) ?? 0) + 1);
  }

  /**
   * Decrement the pin count for `key`, clamped at zero. Does NOT dispose or
   * remove the entry — it simply becomes eligible for ordinary LRU eviction
   * on the next overflow.
   */
  unpin(key: string): void {
    const count = this.pins.get(key) ?? 0;
    if (count <= 1) {
      this.pins.delete(key);
    } else {
      this.pins.set(key, count - 1);
    }
  }

  private isPinned(key: string): boolean {
    return (this.pins.get(key) ?? 0) > 0;
  }

  private evictOverflow(): void {
    if (this.map.size <= this.maxEntries) return;
    // Collect the candidate keys before mutating the map. The last key in
    // insertion order is the one we just inserted (most recently used) — it
    // is never an eviction candidate on its own insertion, so we exclude it
    // from the scan. This ensures that when all pre-existing entries are
    // pinned the cache temporarily grows rather than immediately evicting
    // the item we just added.
    const keys = Array.from(this.map.keys());
    const candidates = keys.slice(0, keys.length - 1); // oldest ... (excluding newest)
    for (const key of candidates) {
      if (this.map.size <= this.maxEntries) break;
      if (this.isPinned(key)) continue;
      const value = this.map.get(key) as V;
      this.map.delete(key);
      this.onEvict?.(key, value);
    }
  }
}
