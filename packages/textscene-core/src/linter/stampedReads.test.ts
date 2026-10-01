/** The linter's per-provider answers, kept under each file's stamp, and the two reads of a provider it goes through. */

import { describe, expect, it } from 'vitest';
import { StampedReads, loadOrNull, stampOf } from './stampedReads.js';
import type { ResourceProvider } from '../resources/ResourceProvider.js';

/** A provider whose stamps come from `stamps`, and a `read` that counts its calls. */
function stamped(stamps: Record<string, string | null>) {
  const provider: ResourceProvider = {
    loadResource: async () => null,
    stamp: async (path) => stamps[path] ?? null,
  };
  let reads = 0;
  const read = async () => ++reads;
  return { provider, read, reads: () => reads };
}

describe('StampedReads.get', () => {
  it('keeps the answer while the stamp is unchanged', async () => {
    const { provider, read, reads } = stamped({ 'res://a': '1' });
    const cache = new StampedReads<number>();

    expect(await cache.get(provider, 'res://a', read)).toBe(1);
    expect(await cache.get(provider, 'res://a', read)).toBe(1);
    expect(reads()).toBe(1);
  });

  it('reads again once the stamp changes, and keeps the new answer', async () => {
    const stamps: Record<string, string> = { 'res://a': '1' };
    const { provider, read, reads } = stamped(stamps);
    const cache = new StampedReads<number>();
    await cache.get(provider, 'res://a', read);

    stamps['res://a'] = '2';

    expect(await cache.get(provider, 'res://a', read)).toBe(2);
    expect(await cache.get(provider, 'res://a', read)).toBe(2);
    expect(reads()).toBe(2);
  });

  it('reads on every call for a null stamp, and forgets the older answer', async () => {
    const stamps: Record<string, string | null> = { 'res://a': '1' };
    const { provider, read, reads } = stamped(stamps);
    const cache = new StampedReads<number>();
    await cache.get(provider, 'res://a', read);

    stamps['res://a'] = null;
    await cache.get(provider, 'res://a', read);
    stamps['res://a'] = '1';
    await cache.get(provider, 'res://a', read);

    expect(reads()).toBe(3);
    expect(cache.peek(provider, 'res://a')).toBe(3);
  });

  it('reads on every call for a provider without a stamp', async () => {
    const provider: ResourceProvider = { loadResource: async () => null };
    let reads = 0;
    const cache = new StampedReads<number>();

    await cache.get(provider, 'res://a', async () => ++reads);
    await cache.get(provider, 'res://a', async () => ++reads);

    expect(reads).toBe(2);
    expect(cache.peek(provider, 'res://a')).toBeUndefined();
  });

  it('starts the read at once for a provider without a stamp', () => {
    let started = false;
    void new StampedReads<number>().get({ loadResource: async () => null }, 'res://a', async () => {
      started = true;
      return 1;
    });

    expect(started).toBe(true);
  });

  it('takes the stamp before the read, so a change during the read is read again next time', async () => {
    const stamps: Record<string, string> = { 'res://a': '1' };
    const { provider } = stamped(stamps);
    const cache = new StampedReads<number>();
    let calls = 0;
    const readThenChange = async () => {
      stamps['res://a'] = '2';
      return ++calls;
    };

    await cache.get(provider, 'res://a', readThenChange);
    await cache.get(provider, 'res://a', readThenChange);

    expect(calls).toBe(2);
  });

  it('keeps one set of answers per provider and per path', async () => {
    const a = stamped({ 'res://a': '1', 'res://b': '1' });
    const b = stamped({ 'res://a': '1' });
    const cache = new StampedReads<string>();
    await cache.get(a.provider, 'res://a', async () => 'a/a');

    expect(await cache.get(a.provider, 'res://b', async () => 'a/b')).toBe('a/b');
    expect(await cache.get(b.provider, 'res://a', async () => 'b/a')).toBe('b/a');
  });

  it('shares a read already running for the path, so two concurrent gets load the file once', async () => {
    let loads = 0;
    const provider: ResourceProvider = {
      loadResource: async () => {
        loads++;
        return 'text';
      },
      stamp: async () => '1',
    };
    const cache = new StampedReads<string | ArrayBuffer | null>();
    const read = () => provider.loadResource('res://a');

    const answers = await Promise.all([cache.get(provider, 'res://a', read), cache.get(provider, 'res://a', read)]);

    expect(answers).toEqual(['text', 'text']);
    expect(loads).toBe(1);
  });

  it('shares a running read for a provider without a stamp too', async () => {
    let reads = 0;
    const provider: ResourceProvider = { loadResource: async () => null };
    const cache = new StampedReads<number>();
    const read = async () => ++reads;

    await Promise.all([cache.get(provider, 'res://a', read), cache.get(provider, 'res://a', read)]);

    expect(reads).toBe(1);
  });

  it('reads again once the shared read has settled', async () => {
    const { provider, read, reads } = stamped({ 'res://a': null });
    const cache = new StampedReads<number>();

    await Promise.all([cache.get(provider, 'res://a', read), cache.get(provider, 'res://a', read)]);
    await cache.get(provider, 'res://a', read);

    expect(reads()).toBe(2);
  });

  it('lets the next get read again after a shared read rejects', async () => {
    const { provider } = stamped({ 'res://a': '1' });
    const cache = new StampedReads<number>();
    const failing = () => Promise.reject(new Error('read failed'));

    const both = [cache.get(provider, 'res://a', failing), cache.get(provider, 'res://a', failing)];
    await expect(Promise.all(both)).rejects.toThrow('read failed');

    expect(await cache.get(provider, 'res://a', async () => 7)).toBe(7);
  });

  it('uses a stamp the caller started earlier, and asks the provider for none', async () => {
    const asked: string[] = [];
    const provider: ResourceProvider = {
      loadResource: async () => null,
      stamp: async (path) => {
        asked.push(path);
        return '1';
      },
    };
    const cache = new StampedReads<number>();

    await cache.get(provider, 'res://a', async () => 1, Promise.resolve('1'));

    expect(asked).toEqual([]);
    expect(cache.peek(provider, 'res://a')).toBe(1);
  });
});

describe('stampOf', () => {
  it('is null for a provider without a stamp, and for a stamp read that rejects', async () => {
    expect(await stampOf({ loadResource: async () => null }, 'res://a')).toBeNull();
    const rejecting: ResourceProvider = {
      loadResource: async () => null,
      stamp: () => Promise.reject(new Error('stat failed')),
    };
    expect(await stampOf(rejecting, 'res://a')).toBeNull();
  });

  it('lets a synchronous throw, a provider bug, through', () => {
    const throwing: ResourceProvider = {
      loadResource: async () => null,
      stamp: () => {
        throw new Error('provider bug');
      },
    };
    expect(() => stampOf(throwing, 'res://a')).toThrow('provider bug');
  });
});

describe('loadOrNull', () => {
  it('is the content, or null for a rejected read', async () => {
    expect(await loadOrNull({ loadResource: async () => 'text' }, 'res://a')).toBe('text');
    expect(await loadOrNull({ loadResource: () => Promise.reject(new Error('missing')) }, 'res://a')).toBeNull();
  });

  it('lets a synchronous throw, a provider bug, through', () => {
    const throwing: ResourceProvider = {
      loadResource: () => {
        throw new Error('provider bug');
      },
    };
    expect(() => loadOrNull(throwing, 'res://a')).toThrow('provider bug');
  });
});
