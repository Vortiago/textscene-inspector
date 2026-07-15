/**
 * Minimal bounded LRU cache. A `Map` wrapper that evicts the
 * least-recently-used entry once `maxEntries` is exceeded, invoking an
 * optional `onEvict` hook so callers can release non-GC resources (dispose a
 * THREE texture/material/geometry) before the reference is dropped.
 *
 * Recency is tracked via `Map`'s insertion-order iteration: `get` and `set`
 * both delete-then-reinsert the key, which moves it to the end of the
 * iteration order, so `keys().next()` is always the least-recently-used
 * entry.
 *
 * ## Disposal on removal (the single owner)
 *
 * Every path that drops a value's reference routes disposal through one
 * pin-aware decision (`disposeOrDefer`): capacity eviction, a replacing
 * `set` (distinct from an `Object.is`-identical re-set), and the explicit
 * caller-driven removals `delete` and `clear` (hot-reload, corpus switch).
 * The reference is dropped exactly the same way regardless of which path
 * removes it, so no removal silently leaks whatever the value owned (a THREE
 * texture/material/geometry).
 *
 * If the key is UNPINNED at removal time, the value is disposed immediately
 * via `onEvict`. If it is PINNED, a mounted consumer may still hold that
 * value, so disposal is DEFERRED until the pin count returns to zero (see
 * below): disposing it out from under the consumer would hand it a dead
 * resource. `evictOverflow` is the one path that never defers — it evicts
 * only zero-pin entries by construction, so it disposes directly.
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
 * `set` that triggers overflow. It DOES flush any disposals deferred by
 * pinned replaces of that key: once no consumer holds a reference, the
 * replaced values are released (skipping a value that has meanwhile been
 * re-set as the key's current value).
 *
 * `delete` and `clear` drop entries and dispose their values (per the rule
 * above) but PRESERVE pin counts: pins track mounted consumers, whose
 * lifecycle is independent of cache contents. A hot-reload deletes and
 * re-sets a key while its consumer stays mounted — the re-set entry must
 * come back protected, and the old value it replaced must not be disposed
 * until that consumer unmounts. Symmetrically, `pin` on a key not (yet) in
 * the cache stores the count and honours it once the key is set. The
 * consumer's eventual `unpin` releases the count either way.
 */
export class LRUCache<V> {
  private readonly map = new Map<string, V>();
  private readonly pins = new Map<string, number>();
  /** Values replaced while their key was pinned, awaiting unpin-to-zero. */
  private readonly deferredDisposals = new Map<string, V[]>();

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
    // the old reference exactly like capacity eviction or an explicit
    // delete/clear does, so it goes through the same pin-aware disposal
    // instead of silently leaking whatever the old value owned (a THREE
    // texture/material/geometry).
    if (existing !== undefined && !Object.is(existing, value)) {
      this.disposeOrDefer(key, existing);
    }
    this.evictOverflow(key);
  }

  delete(key: string): boolean {
    if (!this.map.has(key)) return false;
    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.disposeOrDefer(key, value);
    return true;
  }

  clear(): void {
    for (const [key, value] of this.map) {
      this.disposeOrDefer(key, value);
    }
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
   * on the next overflow. Reaching zero flushes any disposals that a
   * replacing `set`, `delete`, or `clear` deferred while the key was pinned.
   */
  unpin(key: string): void {
    const count = this.pins.get(key) ?? 0;
    if (count <= 1) {
      this.pins.delete(key);
      this.flushDeferredDisposals(key);
    } else {
      this.pins.set(key, count - 1);
    }
  }

  private isPinned(key: string): boolean {
    return (this.pins.get(key) ?? 0) > 0;
  }

  /**
   * Drop `value`'s reference for `key`: dispose it immediately when the entry
   * is unpinned, or defer disposal to the last unpin when a mounted consumer
   * may still hold it. The single owner of disposal-on-removal, shared by a
   * replacing `set`, `delete`, and `clear`. Deferred values accumulate and
   * are released by `flushDeferredDisposals`, which de-duplicates and skips a
   * value that is live again as the key's current entry.
   */
  private disposeOrDefer(key: string, value: V): void {
    if (this.isPinned(key)) {
      const pending = this.deferredDisposals.get(key) ?? [];
      pending.push(value);
      this.deferredDisposals.set(key, pending);
    } else {
      this.onEvict?.(key, value);
    }
  }

  /**
   * Dispose values whose removal (a replacing `set`, `delete`, or `clear`)
   * happened while `key` was pinned, now that no consumer holds a reference.
   * Skips a value that is `Object.is` the key's CURRENT cached value (it was
   * re-set after being removed and is live again), and disposes each distinct
   * value at most once.
   */
  private flushDeferredDisposals(key: string): void {
    const pending = this.deferredDisposals.get(key);
    if (!pending) return;
    this.deferredDisposals.delete(key);
    const current = this.map.get(key);
    const disposed: V[] = [];
    for (const value of pending) {
      if (current !== undefined && Object.is(value, current)) continue;
      if (disposed.some((d) => Object.is(d, value))) continue;
      disposed.push(value);
      this.onEvict?.(key, value);
    }
  }

  /**
   * Evict least-recently-used zero-pin entries until the cache is back
   * within `maxEntries`. `justSet` — the key the triggering `set` inserted —
   * is never a candidate on its own insertion: when every other entry is
   * pinned the cache temporarily grows rather than immediately evicting the
   * item just added. (Deleting the entry being visited while iterating a
   * `Map`'s keys is well-defined.)
   */
  private evictOverflow(justSet: string): void {
    for (const key of this.map.keys()) {
      if (this.map.size <= this.maxEntries) return;
      if (key === justSet || this.isPinned(key)) continue;
      const value = this.map.get(key) as V;
      this.map.delete(key);
      this.onEvict?.(key, value);
    }
  }
}
