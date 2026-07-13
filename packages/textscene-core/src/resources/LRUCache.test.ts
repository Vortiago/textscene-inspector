/**
 * Tests for LRUCache — the bounded cache backing `createResourceProcessor`'s
 * per-type resource cache. Pins recency tracking, eviction, and the
 * `onEvict` disposal hook contract independent of any resource-loading
 * concern. Also covers the pin/unpin reference-counting API that prevents
 * eviction of mounted consumers.
 */
import { describe, it, expect, vi } from 'vitest';
import { LRUCache } from './LRUCache';

describe('LRUCache', () => {
  it('stores and retrieves a value under maxEntries', () => {
    const cache = new LRUCache<string>(3);
    cache.set('a', 'A');

    expect(cache.has('a')).toBe(true);
    expect(cache.get('a')).toBe('A');
    expect(cache.size).toBe(1);
  });

  it('has() and get() report absence for a key never set', () => {
    const cache = new LRUCache<string>(3);
    expect(cache.has('missing')).toBe(false);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the least-recently-inserted entry once maxEntries is exceeded', () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string>(2, onEvict);

    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C'); // over capacity -> evicts 'a' (oldest, untouched)

    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.size).toBe(2);
    expect(onEvict).toHaveBeenCalledTimes(1);
    expect(onEvict).toHaveBeenCalledWith('a', 'A');
  });

  it('get() bumps recency so a touched entry survives eviction', () => {
    const cache = new LRUCache<string>(2);

    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.get('a'); // touch 'a' -> 'b' is now the least-recently-used
    cache.set('c', 'C'); // over capacity -> evicts 'b', not 'a'

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });

  it('re-setting an existing key updates its value and bumps recency without growing size', () => {
    const cache = new LRUCache<string>(2);

    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('a', 'A2'); // update + bump -> 'b' becomes least-recently-used
    cache.set('c', 'C'); // over capacity -> evicts 'b'

    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBe('A2');
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });

  it('re-setting an existing key with a different value disposes the value it replaces', () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string>(3, onEvict);
    cache.set('a', 'A');

    cache.set('a', 'A2'); // replaces 'A' — the old reference is dropped here, not via capacity eviction

    expect(cache.get('a')).toBe('A2');
    expect(onEvict).toHaveBeenCalledTimes(1);
    expect(onEvict).toHaveBeenCalledWith('a', 'A');
  });

  it('re-setting an existing key with the SAME value (Object.is) does not invoke onEvict', () => {
    const onEvict = vi.fn();
    const shared = { label: 'shared' };
    const cache = new LRUCache<typeof shared>(3, onEvict);
    cache.set('a', shared);

    cache.set('a', shared); // identical reference — nothing was actually replaced

    expect(onEvict).not.toHaveBeenCalled();
  });

  it('the FIRST set() of a brand-new key never invokes onEvict (nothing to replace)', () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string>(3, onEvict);

    cache.set('a', 'A');

    expect(onEvict).not.toHaveBeenCalled();
  });

  it('delete() removes a single entry without invoking onEvict', () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string>(3, onEvict);
    cache.set('a', 'A');

    expect(cache.delete('a')).toBe(true);
    expect(cache.has('a')).toBe(false);
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('delete() returns false for a key that is not present', () => {
    const cache = new LRUCache<string>(3);
    expect(cache.delete('nope')).toBe(false);
  });

  it('clear() drops every entry without invoking onEvict', () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string>(3, onEvict);
    cache.set('a', 'A');
    cache.set('b', 'B');

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(false);
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('values() iterates every live entry in insertion/recency order', () => {
    const cache = new LRUCache<string>(3);
    cache.set('a', 'A');
    cache.set('b', 'B');
    cache.set('c', 'C');

    expect(Array.from(cache.values())).toEqual(['A', 'B', 'C']);
  });

  it('tolerates a maxEntries of 1 by always keeping only the most recent entry', () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string>(1, onEvict);
    cache.set('a', 'A');
    cache.set('b', 'B');

    expect(cache.size).toBe(1);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(true);
    expect(onEvict).toHaveBeenCalledWith('a', 'A');
  });

  // -------------------------------------------------------------------
  // Reference-counting: pin / unpin
  // -------------------------------------------------------------------
  describe('pin / unpin', () => {
    it('a pinned entry is skipped by evictOverflow — zero-count entries are evicted first', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>(2, onEvict);
      cache.set('a', 'A');
      cache.set('b', 'B');
      cache.pin('a'); // 'a' is now pinned (count = 1)

      // Adding 'c' would evict 'a' (LRU) but it's pinned, so 'b' goes instead.
      cache.set('c', 'C');

      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
      expect(cache.has('c')).toBe(true);
      expect(onEvict).toHaveBeenCalledWith('b', 'B');
      expect(onEvict).not.toHaveBeenCalledWith('a', 'A');
    });

    it('after unpin the entry is evictable again', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>(2, onEvict);
      cache.set('a', 'A');
      cache.set('b', 'B');
      cache.pin('a');
      cache.unpin('a'); // count back to 0 — evictable

      cache.set('c', 'C'); // over capacity -> 'a' is now the LRU zero-count entry
      expect(cache.has('a')).toBe(false);
      expect(onEvict).toHaveBeenCalledWith('a', 'A');
    });

    it('multiple pins require the same number of unpins before the entry becomes evictable', () => {
      // Use capacity 2 so we have room for the pinned entry plus one
      // "other" — only 'a' is pinned, there are no other zero-count
      // candidates, so the cache must temporarily exceed capacity.
      const onEvict = vi.fn();
      const cache = new LRUCache<string>(2, onEvict);
      cache.set('a', 'A');
      cache.pin('a');
      cache.pin('a'); // count = 2

      // Only 'a' is in the cache and it is pinned — adding 'b' makes size=2 (at capacity, no overflow).
      cache.set('b', 'B');
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(true);
      expect(onEvict).not.toHaveBeenCalled();

      // Adding 'c' triggers overflow. 'a' is pinned (count=2), 'b' is not -> evict 'b'.
      cache.set('c', 'C');
      expect(cache.has('a')).toBe(true); // still pinned
      expect(cache.has('b')).toBe(false); // evicted (zero-count LRU)
      expect(cache.has('c')).toBe(true);
      expect(onEvict).toHaveBeenCalledWith('b', 'B');
      onEvict.mockClear();

      cache.unpin('a'); // count = 1 — still pinned
      // No other zero-count entries present; adding 'd' can only evict 'c'.
      cache.set('d', 'D');
      expect(cache.has('a')).toBe(true);
      expect(cache.has('c')).toBe(false);
      expect(cache.has('d')).toBe(true);
      onEvict.mockClear();

      cache.unpin('a'); // count = 0 — evictable now

      // 'a' is the LRU zero-count entry (oldest, never re-touched after insertion).
      cache.set('e', 'E');
      expect(cache.has('a')).toBe(false);
      expect(onEvict).toHaveBeenCalledWith('a', 'A');
    });

    it('when every entry is pinned and capacity is exceeded, the cache temporarily exceeds maxEntries', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>(2, onEvict);
      cache.set('a', 'A');
      cache.set('b', 'B');
      cache.pin('a');
      cache.pin('b');

      // Both entries pinned — no eviction candidate.
      cache.set('c', 'C');

      expect(cache.size).toBe(3); // temporarily over capacity
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(true);
      expect(cache.has('c')).toBe(true);
      expect(onEvict).not.toHaveBeenCalled();

      // Releasing 'a' pin makes it evictable; 'c' is also unpinned.
      cache.unpin('a');
      // Eviction happens lazily on next set — trigger it.
      cache.set('d', 'D');

      // After insertion size=4 > maxEntries=2. In LRU order: 'a' (unpinned,
      // evict), 'b' (pinned, skip), 'c' (unpinned, evict), 'd' is the
      // just-inserted entry (excluded from this pass). Result: {b, d}.
      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(true); // still pinned
      expect(cache.has('c')).toBe(false); // evicted as unpinned LRU
      expect(cache.has('d')).toBe(true);
      expect(cache.size).toBe(2);
      expect(onEvict).toHaveBeenCalledWith('a', 'A');
      expect(onEvict).toHaveBeenCalledWith('c', 'C');
    });

    it('unpin to zero does NOT eagerly dispose the entry — it remains in cache', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>(3, onEvict);
      cache.set('a', 'A');
      cache.pin('a');
      cache.unpin('a'); // count back to 0

      // Entry is still present — unpin is not delete.
      expect(cache.has('a')).toBe(true);
      expect(cache.get('a')).toBe('A');
      expect(onEvict).not.toHaveBeenCalled();
    });

    it('pin on a key not yet in the cache is a no-op (does not throw)', () => {
      const cache = new LRUCache<string>(3);
      expect(() => cache.pin('ghost')).not.toThrow();
      expect(() => cache.unpin('ghost')).not.toThrow();
    });

    it('unpin below zero is clamped to zero (never negative)', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>(1, onEvict);
      cache.set('a', 'A');
      cache.pin('a');
      cache.unpin('a');
      cache.unpin('a'); // extra unpin — clamped at zero

      // A single pin must protect again: if the count had gone to -1, this
      // pin would only bring it back to 0 and 'a' would be evicted below.
      cache.pin('a');
      cache.set('b', 'B'); // overflow — 'a' is the LRU candidate but pinned
      expect(cache.has('a')).toBe(true);
      expect(onEvict).not.toHaveBeenCalled();
    });

    it('delete preserves the pin count — a re-set key comes back protected (hot-reload)', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>(1, onEvict);
      cache.set('a', 'A');
      cache.pin('a'); // mounted consumer
      cache.delete('a'); // host invalidation (clearCache / provideFile)
      cache.set('a', 'A2'); // reload lands — must still be pinned

      cache.set('b', 'B'); // overflow — 'a' is the LRU candidate but pinned
      expect(cache.has('a')).toBe(true);
      expect(onEvict).not.toHaveBeenCalledWith('a', expect.anything());

      cache.unpin('a'); // consumer unmounts — accounting stays balanced
      cache.set('c', 'C');
      expect(cache.has('a')).toBe(false);
    });

    it('clear preserves pin counts — re-set keys come back protected', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>(1, onEvict);
      cache.set('a', 'A');
      cache.pin('a');
      cache.clear();
      cache.set('a', 'A2');

      cache.set('b', 'B'); // overflow — 'a' is the LRU candidate but pinned
      expect(cache.has('a')).toBe(true);
      expect(onEvict).not.toHaveBeenCalledWith('a', expect.anything());
    });

    it('StrictMode double-invoke: mount -> unmount -> mount ends at pin count 1, never disposes', () => {
      // React StrictMode calls mount effect, then immediately unmount + remount.
      // Simulated sequence: pin (mount) -> unpin (unmount) -> pin (remount).
      const onEvict = vi.fn();
      const cache = new LRUCache<string>(1, onEvict);
      cache.set('a', 'A');

      cache.pin('a');   // mount (count = 1)
      cache.unpin('a'); // unmount (count = 0)
      cache.pin('a');   // remount (count = 1)

      // Must still be present and pinned.
      expect(cache.has('a')).toBe(true);
      expect(onEvict).not.toHaveBeenCalled();

      // Should NOT be evictable yet (pin count is 1).
      cache.set('b', 'B'); // would evict 'a' if it were unpinned
      expect(cache.has('a')).toBe(true);
      expect(onEvict).not.toHaveBeenCalled();
    });
  });
});
