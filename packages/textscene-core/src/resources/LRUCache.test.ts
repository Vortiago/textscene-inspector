/**
 * Tests for LRUCache — the bounded cache backing `createResourceProcessor`'s
 * per-type resource cache. Pins recency tracking, eviction, and the
 * `onEvict` disposal hook contract independent of any resource-loading
 * concern.
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
});
