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

  it('delete() disposes an unpinned entry immediately via onEvict', () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string>(3, onEvict);
    cache.set('a', 'A');

    expect(cache.delete('a')).toBe(true);
    expect(cache.has('a')).toBe(false);
    // No mounted consumer holds it, so the value is released right away.
    expect(onEvict).toHaveBeenCalledTimes(1);
    expect(onEvict).toHaveBeenCalledWith('a', 'A');
  });

  it('delete() returns false for a key that is not present', () => {
    const cache = new LRUCache<string>(3);
    expect(cache.delete('nope')).toBe(false);
  });

  it('clear() disposes every unpinned entry via onEvict', () => {
    const onEvict = vi.fn();
    const cache = new LRUCache<string>(3, onEvict);
    cache.set('a', 'A');
    cache.set('b', 'B');

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(false);
    // Nothing is pinned, so both values are released immediately.
    expect(onEvict).toHaveBeenCalledTimes(2);
    expect(onEvict).toHaveBeenCalledWith('a', 'A');
    expect(onEvict).toHaveBeenCalledWith('b', 'B');
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

    it('clear() disposes unpinned entries immediately but defers pinned ones to unpin', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>(5, onEvict);
      cache.set('pinned', 'P');
      cache.set('loose', 'L');
      cache.pin('pinned'); // a mounted consumer still holds 'P'

      cache.clear();

      // The unpinned value is released now; the pinned one is held back.
      expect(onEvict.mock.calls).toEqual([['loose', 'L']]);

      cache.unpin('pinned'); // consumer unmounts — 'P' released exactly once
      expect(onEvict.mock.calls).toEqual([
        ['loose', 'L'],
        ['pinned', 'P'],
      ]);
    });

    it('delete() defers a pinned value, then disposes it exactly once on the last unpin', () => {
      const onEvict = vi.fn();
      const cache = new LRUCache<string>(3, onEvict);
      cache.set('a', 'A');
      cache.pin('a');
      cache.pin('a'); // two mounted consumers

      cache.delete('a');
      expect(onEvict).not.toHaveBeenCalled(); // held while any pin remains

      cache.unpin('a'); // count 2 -> 1: still held
      expect(onEvict).not.toHaveBeenCalled();

      cache.unpin('a'); // count 1 -> 0: released once
      expect(onEvict.mock.calls).toEqual([['a', 'A']]);
    });

    describe('replace-while-pinned defers disposal until unpin-to-zero', () => {
      interface DeferredDisposalCase {
        name: string;
        /** Ops executed against a capacity-5 cache with a spy onEvict. */
        script: (cache: LRUCache<string>) => void;
        /** Expected full onEvict call list, in order, after the script. */
        expectedDisposals: [key: string, value: string][];
        /** Expected surviving current value of 'a' (undefined = evicted/absent). */
        expectedCurrent: string | undefined;
      }

      const cases: DeferredDisposalCase[] = [
        {
          name: 'replace while pinned does NOT dispose the old value immediately',
          script: (c) => {
            c.set('a', 'A');
            c.pin('a');
            c.set('a', 'A2'); // hot-reload lands while the consumer is mounted
          },
          expectedDisposals: [],
          expectedCurrent: 'A2',
        },
        {
          name: 'unpin to zero flushes the deferred disposal of the replaced value',
          script: (c) => {
            c.set('a', 'A');
            c.pin('a');
            c.set('a', 'A2');
            c.unpin('a'); // consumer unmounts — nothing holds 'A' any more
          },
          expectedDisposals: [['a', 'A']],
          expectedCurrent: 'A2',
        },
        {
          name: 'multiple replaces while pinned flush every superseded value on unpin-to-zero',
          script: (c) => {
            c.set('a', 'A');
            c.pin('a');
            c.set('a', 'A2');
            c.set('a', 'A3');
            c.unpin('a');
          },
          expectedDisposals: [
            ['a', 'A'],
            ['a', 'A2'],
          ],
          expectedCurrent: 'A3',
        },
        {
          name: 'a deferred value re-set as current again is NOT disposed at flush time',
          script: (c) => {
            c.set('a', 'A');
            c.pin('a');
            c.set('a', 'A2'); // defers 'A'
            c.set('a', 'A'); // defers 'A2'; 'A' is live again
            c.unpin('a');
          },
          expectedDisposals: [['a', 'A2']],
          expectedCurrent: 'A',
        },
        {
          name: 'a value deferred twice (replaced, restored, replaced again) is disposed only once',
          script: (c) => {
            c.set('a', 'A');
            c.pin('a');
            c.set('a', 'A2'); // defers 'A'
            c.set('a', 'A'); // defers 'A2'
            c.set('a', 'A3'); // defers 'A' again
            c.unpin('a');
          },
          expectedDisposals: [
            ['a', 'A'],
            ['a', 'A2'],
          ],
          expectedCurrent: 'A3',
        },
        {
          name: 'Object.is-identical re-set while pinned defers nothing; unpin flushes nothing',
          script: (c) => {
            c.set('a', 'A');
            c.pin('a');
            c.set('a', 'A'); // no-op re-set
            c.unpin('a');
          },
          expectedDisposals: [],
          expectedCurrent: 'A',
        },
        {
          name: 'multi-pin: unpin from 2 to 1 does not flush; the final unpin does',
          script: (c) => {
            c.set('a', 'A');
            c.pin('a');
            c.pin('a');
            c.set('a', 'A2');
            c.unpin('a'); // count 2 -> 1: second consumer may still hold 'A'
            expect(c.get('a')).toBe('A2');
            c.unpin('a'); // count 1 -> 0: flush
          },
          expectedDisposals: [['a', 'A']],
          expectedCurrent: 'A2',
        },
        {
          name: 'delete while pinned defers BOTH the superseded and the current value until unpin-to-zero',
          script: (c) => {
            c.set('a', 'A');
            c.pin('a');
            c.set('a', 'A2'); // defers 'A'
            c.delete('a'); // pinned — defers the current 'A2' too; pins survive
            c.unpin('a'); // consumer unmounts: 'A' and 'A2' finally released
          },
          expectedDisposals: [
            ['a', 'A'],
            ['a', 'A2'],
          ],
          expectedCurrent: undefined,
        },
        {
          name: 'clear while pinned defers the current value until unpin-to-zero',
          script: (c) => {
            c.set('a', 'A');
            c.pin('a');
            c.clear(); // pinned — defers 'A'; pins survive the clear
            c.unpin('a'); // consumer unmounts: 'A' released
          },
          expectedDisposals: [['a', 'A']],
          expectedCurrent: undefined,
        },
        {
          name: 'replace while NOT pinned still disposes the old value immediately',
          script: (c) => {
            c.set('a', 'A');
            c.set('a', 'A2');
          },
          expectedDisposals: [['a', 'A']],
          expectedCurrent: 'A2',
        },
      ];

      it.each(cases)('$name', ({ script, expectedDisposals, expectedCurrent }) => {
        const onEvict = vi.fn();
        const cache = new LRUCache<string>(5, onEvict);

        script(cache);

        expect(onEvict.mock.calls).toEqual(expectedDisposals);
        expect(cache.get('a')).toBe(expectedCurrent);
      });
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
