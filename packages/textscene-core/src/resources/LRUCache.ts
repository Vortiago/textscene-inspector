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
 * The deferred backlog per key is capped at ONE value: when a second removal
 * defers while the key is still pinned, anything already pending was
 * superseded a full replace-cycle ago — consumers re-read on the replacing
 * set's `loaded` event — so it is released then. Without the cap a long
 * editing session (one hot-reload per save, consumer mounted throughout)
 * would retain every superseded decoded copy until unmount.
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
  /** The (at most one) value per key replaced while pinned, awaiting release. */
  private readonly deferredDisposals = new Map<string, V>();
  /**
   * Count of keys present in `map` with a nonzero pin count. Its complement
   * (`map.size - pinnedInMap`) is the eviction-candidate count, letting
   * `evictOverflow` bail in O(1) when nothing is evictable; without it, a
   * regime where pinned entries alone exceed `maxEntries` made every `set()`
   * walk the entire map (O(N²) across N streaming loads). Tracking the
   * PINNED count (not its complement) keeps the eviction loop itself free of
   * bookkeeping — eviction only ever removes zero-pin keys.
   */
  private pinnedInMap = 0;

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
    if (!this.map.has(key) && this.isPinned(key)) this.pinnedInMap++;
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
   * Increment the pin count for `key`. While count > 0, `evictOverflow`
   * will not evict this entry. Safe to call for a key not yet in the cache
   * (the count is stored and honoured once the key is set).
   */
  pin(key: string): void {
    const count = this.pins.get(key) ?? 0;
    if (count === 0 && this.map.has(key)) this.pinnedInMap++;
    this.pins.set(key, count + 1);
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
   * Drop `value`'s reference for `key`: dispose it immediately when the entry
   * is unpinned, or defer disposal when a mounted consumer may still hold it.
   * The single owner of disposal-on-removal, shared by a replacing `set`,
   * `delete`, and `clear`.
   *
   * At most ONE deferred value is kept per key (structurally — the map holds
   * a single value). A value already pending when a newer removal defers was
   * superseded a full replace-cycle earlier — consumers re-read on the
   * replacing set's `loaded` event — so it is released here rather than
   * retained until unmount. (Residual race: a consumer that has not yet
   * processed that `loaded` re-render when the NEXT removal lands would
   * briefly hold the disposed value; two removals inside one unflushed React
   * batch is the only way to hit it.) The last pending value is released by
   * `flushDeferredDisposal` at unpin-to-zero.
   */
  private disposeOrDefer(key: string, value: V): void {
    if (this.isPinned(key)) {
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
   * Dispose the value whose removal happened while `key` was pinned, now
   * that no consumer holds a reference. Skips a value that is `Object.is`
   * the key's CURRENT cached value (re-set after removal — live again).
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
   * Evict least-recently-used zero-pin entries until the cache is back
   * within `maxEntries`. `justSet` — the key the triggering `set` inserted —
   * is never a candidate on its own insertion: when every other entry is
   * pinned the cache temporarily grows rather than immediately evicting the
   * item just added. (Deleting the entry being visited while iterating a
   * `Map`'s keys is well-defined.)
   */
  private evictOverflow(justSet: string): void {
    if (this.map.size <= this.maxEntries) return;
    // O(1) bail when nothing is evictable (see pinnedInMap). `justSet` is
    // never a candidate on its own insertion.
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
