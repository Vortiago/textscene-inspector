/**
 * `createResourceProcessor`, the factory behind every processor, in both fetch
 * modes: FileEventBus-driven (`shouldProcess` and `process`) and direct (`loadDirectly`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResourceProcessor, type ResourceProcessor } from './createResourceProcessor';
import { ResourceEventBus } from './ResourceEventBus';
import { FileEventBus, type FileData } from './FileEventBus';
import type { ResourceProvider } from './ResourceProvider';

/** Controllable provider backing the FileEventBus-driven mode. */
class MockProvider implements ResourceProvider {
  files = new Map<string, string | ArrayBuffer>();
  loadResource = vi.fn(async (path: string): Promise<string | ArrayBuffer | null> => {
    return this.files.get(path) ?? null;
  });
}

const flush = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('createResourceProcessor', () => {
  let eventBus: ResourceEventBus;

  beforeEach(() => {
    eventBus = new ResourceEventBus();
  });

  describe('FileEventBus-driven mode', () => {
    let provider: MockProvider;
    let fileEventBus: FileEventBus;
    let processSpy: ReturnType<typeof vi.fn>;
    let processor: ResourceProcessor<string>;

    beforeEach(() => {
      provider = new MockProvider();
      fileEventBus = new FileEventBus(provider);
      processSpy = vi.fn(async (_path: string, data: FileData) => `processed:${String(data)}`);
      processor = createResourceProcessor<string>({
        fileEventBus,
        eventBus,
        resourceType: 'resource',
        shouldProcess: (_path, data) => typeof data === 'string',
        process: processSpy as (path: string, data: FileData) => Promise<string>,
      });
    });

    it('dedupes two simultaneous requests for the same path into one load', async () => {
      provider.loadResource = vi.fn(
        async () => new Promise<string>((resolve) => setTimeout(() => resolve('bytes'), 10))
      );
      const requestSpy = vi.spyOn(fileEventBus, 'request');
      const loadedHandler = vi.fn();
      eventBus.on<string>('resource', 'loaded', loadedHandler);

      processor.request('res://a.txt');
      processor.request('res://a.txt');
      await flush(40);

      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(provider.loadResource).toHaveBeenCalledTimes(1);
      expect(loadedHandler).toHaveBeenCalledTimes(1);
      expect(loadedHandler).toHaveBeenCalledWith('res://a.txt', 'processed:bytes');
    });

    it('reaches finishLoad and emits requested -> loading -> loaded with the processed resource', async () => {
      provider.files.set('res://a.txt', 'raw');
      const sequence: string[] = [];
      eventBus.on('resource', 'requested', () => sequence.push('requested'));
      eventBus.on('resource', 'loading', () => sequence.push('loading'));
      eventBus.on('resource', 'loaded', () => sequence.push('loaded'));

      processor.request('res://a.txt');
      await flush();

      expect(sequence).toEqual(['requested', 'loading', 'loaded']);
      expect(processor.getCached('res://a.txt')).toBe('processed:raw');
      expect(processor.isCached('res://a.txt')).toBe(true);
      expect(processor.isLoading('res://a.txt')).toBe(false);
    });

    it('drops the raw FileEventBus bytes once processing succeeds (avoids double-retention)', async () => {
      provider.files.set('res://a.txt', 'raw');

      processor.request('res://a.txt');
      await flush();

      // The decoded resource is cached by the processor...
      expect(processor.isCached('res://a.txt')).toBe(true);
      // ...but the raw bytes FileEventBus held to produce it are gone.
      expect(fileEventBus.isCached('res://a.txt')).toBe(false);
    });

    it('drops the raw FileEventBus bytes when processing fails too (no retry needs them)', async () => {
      provider.files.set('res://a.txt', 'raw');
      processSpy.mockImplementation(async () => {
        throw new Error('decode failed');
      });
      eventBus.on<Error>('resource', 'failed', () => {});

      processor.request('res://a.txt');
      await flush();

      expect(processor.getCached('res://a.txt')).toBeNull();
      expect(fileEventBus.isCached('res://a.txt')).toBe(false);
    });

    it('shouldProcess gating: a non-matching arrival is left for another processor (no process, no emission, still inflight)', async () => {
      // ArrayBuffer data fails this processor's `typeof data === 'string'` gate.
      provider.files.set('res://a.bin', new ArrayBuffer(4));
      const loadedHandler = vi.fn();
      const failedHandler = vi.fn();
      eventBus.on('resource', 'loaded', loadedHandler);
      eventBus.on('resource', 'failed', failedHandler);

      processor.request('res://a.bin');
      await flush();

      expect(processSpy).not.toHaveBeenCalled();
      expect(loadedHandler).not.toHaveBeenCalled();
      expect(failedHandler).not.toHaveBeenCalled();
      // The request stays in flight: a sibling processor on the same FileEventBus
      // handles data this one rejects.
      expect(processor.isLoading('res://a.bin')).toBe(true);
      expect(processor.isCached('res://a.bin')).toBe(false);
      // This processor did not consume the bytes, so it must not drop them
      // from under the sibling processor that will.
      expect(fileEventBus.isCached('res://a.bin')).toBe(true);
    });

    it('a failure is cached and a repeat request re-emits its reason WITHOUT re-hitting the provider', async () => {
      // Provider has no file -> FileEventBus emits failed -> processor caches the failure.
      const failedHandler = vi.fn();
      eventBus.on<Error>('resource', 'failed', failedHandler);

      processor.request('res://missing.txt');
      await flush();

      expect(failedHandler).toHaveBeenCalledTimes(1);
      expect(processor.getCached('res://missing.txt')).toBeNull();
      expect(provider.loadResource).toHaveBeenCalledTimes(1);

      processor.request('res://missing.txt');

      // Re-emitted synchronously from cache; the provider was not consulted again.
      expect(failedHandler).toHaveBeenCalledTimes(2);
      expect(failedHandler.mock.calls[1]![1]).toBe(failedHandler.mock.calls[0]![1]);
      expect(provider.loadResource).toHaveBeenCalledTimes(1);
    });

    it('a throwing process() lands in failed, not an unhandled rejection', async () => {
      provider.files.set('res://a.txt', 'raw');
      const boom = new Error('boom');
      processSpy.mockImplementation(() => {
        throw boom;
      });
      const failedHandler = vi.fn();
      eventBus.on<Error>('resource', 'failed', failedHandler);

      // Vitest fails the run on unhandled rejections, so reaching the
      // assertions below proves the throw was contained.
      processor.request('res://a.txt');
      await flush();

      expect(failedHandler).toHaveBeenCalledWith('res://a.txt', boom);
      expect(processor.getCached('res://a.txt')).toBeNull();
      expect(processor.isLoading('res://a.txt')).toBe(false);
    });

    it('bus mode without a process() handler fails the request explicitly', async () => {
      provider.files.set('res://a.txt', 'raw');
      const noProcess = createResourceProcessor<string>({
        fileEventBus,
        eventBus,
        resourceType: 'resource',
        shouldProcess: (_path, data) => typeof data === 'string',
      });
      const failedHandler = vi.fn();
      eventBus.on<Error>('resource', 'failed', failedHandler);

      noProcess.request('res://a.txt');
      await flush();

      expect(failedHandler).toHaveBeenCalledTimes(1);
      expect((failedHandler.mock.calls[0]![1] as Error).message).toContain('missing process() handler');
      expect(noProcess.getCached('res://a.txt')).toBeNull();
    });
  });

  describe('direct-load mode (loadDirectly)', () => {
    it('reaches finishLoad and emits requested -> loading -> loaded', async () => {
      const loadDirectly = vi.fn(async (path: string) => `direct:${path}`);
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly,
      });
      const sequence: string[] = [];
      eventBus.on('resource', 'requested', () => sequence.push('requested'));
      eventBus.on('resource', 'loading', () => sequence.push('loading'));
      eventBus.on('resource', 'loaded', (id, data) => sequence.push(`loaded:${id}:${String(data)}`));

      processor.request('res://scene.tscn');
      await flush();

      expect(loadDirectly).toHaveBeenCalledWith('res://scene.tscn');
      expect(sequence).toEqual(['requested', 'loading', 'loaded:res://scene.tscn:direct:res://scene.tscn']);
      expect(processor.getCached('res://scene.tscn')).toBe('direct:res://scene.tscn');
    });

    it('a failure is cached and a repeat request re-emits its reason WITHOUT re-invoking loadDirectly', async () => {
      const loadDirectly = vi.fn(async () => {
        throw new Error('disk on fire');
      });
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly,
      });
      const failedHandler = vi.fn();
      eventBus.on<Error>('resource', 'failed', failedHandler);

      processor.request('res://scene.tscn');
      await flush();

      expect(loadDirectly).toHaveBeenCalledTimes(1);
      expect(failedHandler).toHaveBeenCalledTimes(1);
      expect((failedHandler.mock.calls[0]![1] as Error).message).toBe('disk on fire');
      expect(processor.getCached('res://scene.tscn')).toBeNull();

      processor.request('res://scene.tscn');

      expect(loadDirectly).toHaveBeenCalledTimes(1);
      expect(failedHandler).toHaveBeenCalledTimes(2);
      expect((failedHandler.mock.calls[1]![1] as Error).message).toBe('disk on fire');
    });
  });

  describe('cache behavior', () => {
    it('cache hit emits loaded synchronously after subscribe-then-request', async () => {
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
      });
      processor.request('res://a');
      await flush();
      expect(processor.isCached('res://a')).toBe(true);

      const handler = vi.fn();
      eventBus.on<string>('resource', 'loaded', handler);
      processor.request('res://a');

      // No await: emission must happen synchronously inside request().
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('res://a', 'direct:res://a');
    });

    it('clearCache(path) disposes an unpinned resource immediately, for that path only', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
        dispose,
      });
      processor.request('res://a');
      processor.request('res://b');
      await flush();
      expect(processor.getCacheSize()).toBe(2);

      processor.clearCache('res://a');

      expect(dispose).toHaveBeenCalledTimes(1);
      expect(dispose).toHaveBeenCalledWith('direct:res://a');
      expect(processor.isCached('res://a')).toBe(false);
      expect(processor.isCached('res://b')).toBe(true);
    });

    it('clearCache(path) on a PINNED resource defers disposal until the last unpin (one dispose)', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
        dispose,
      });
      processor.request('res://a');
      await flush();
      processor.pin('res://a'); // a mounted consumer still holds this resource

      processor.clearCache('res://a');

      // The value a mounted mesh still references must not be disposed under it.
      expect(dispose).not.toHaveBeenCalled();
      expect(processor.isCached('res://a')).toBe(false);

      processor.unpin('res://a'); // consumer unmounts: released exactly once
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(dispose).toHaveBeenCalledWith('direct:res://a');
    });

    it('clearCache() disposes every cached resource and skips null failure entries', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => {
          if (path === 'res://bad') throw new Error('nope');
          return `direct:${path}`;
        },
        dispose,
      });
      processor.request('res://good');
      processor.request('res://bad');
      await flush();
      expect(processor.getCacheSize()).toBe(2);

      processor.clearCache();

      expect(dispose).toHaveBeenCalledTimes(1);
      expect(dispose).toHaveBeenCalledWith('direct:res://good');
      expect(processor.getCacheSize()).toBe(0);
    });

    it('clearCache() disposes unpinned entries now but defers pinned ones to their last unpin', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
        dispose,
      });
      processor.request('res://pinned');
      processor.request('res://unpinned');
      await flush();
      processor.pin('res://pinned'); // held by a mounted consumer

      processor.clearCache();

      // Unpinned value released immediately; the pinned one is held back.
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(dispose).toHaveBeenCalledWith('direct:res://unpinned');
      expect(dispose).not.toHaveBeenCalledWith('direct:res://pinned');
      expect(processor.getCacheSize()).toBe(0);

      processor.unpin('res://pinned'); // consumer unmounts: released once
      expect(dispose).toHaveBeenCalledTimes(2);
      expect(dispose).toHaveBeenCalledWith('direct:res://pinned');
    });
  });

  describe('bounded cache', () => {
    it('evicts the least-recently-used entry once maxEntries is exceeded, disposing it', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
        dispose,
        maxEntries: 2,
      });

      processor.request('res://a');
      await flush();
      processor.request('res://b');
      await flush();
      processor.request('res://c'); // over capacity -> evicts 'res://a'
      await flush();

      expect(processor.getCacheSize()).toBe(2);
      expect(processor.isCached('res://a')).toBe(false);
      expect(processor.isCached('res://b')).toBe(true);
      expect(processor.isCached('res://c')).toBe(true);
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(dispose).toHaveBeenCalledWith('direct:res://a');
    });

    it('a cache-hit re-request bumps recency, protecting it from eviction', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
        dispose,
        maxEntries: 2,
      });

      processor.request('res://a');
      await flush();
      processor.request('res://b');
      await flush();
      processor.request('res://a'); // cache-hit -> bumps 'a' recency
      processor.request('res://c'); // over capacity -> evicts 'b', not 'a'
      await flush();

      expect(processor.isCached('res://a')).toBe(true);
      expect(processor.isCached('res://b')).toBe(false);
      expect(processor.isCached('res://c')).toBe(true);
      expect(dispose).toHaveBeenCalledWith('direct:res://b');
    });

    it('does not dispose a failed (null) entry on eviction', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => {
          if (path === 'res://bad') throw new Error('nope');
          return `direct:${path}`;
        },
        dispose,
        maxEntries: 1,
      });

      processor.request('res://bad');
      await flush();
      processor.request('res://good'); // over capacity -> evicts 'res://bad' (null)

      expect(dispose).not.toHaveBeenCalled();
    });

    it('leaves the cache unbounded for practical purposes by default (no eviction across a normal scene-sized set)', async () => {
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
      });

      for (let i = 0; i < 50; i += 1) {
        processor.request(`res://item-${i}`);
      }
      await flush();

      expect(processor.getCacheSize()).toBe(50);
      expect(processor.isCached('res://item-0')).toBe(true);
    });
  });

  describe('misconfiguration', () => {
    it('emits failed when neither fetch mode is configured', () => {
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
      });
      const failedHandler = vi.fn();
      eventBus.on<Error>('resource', 'failed', failedHandler);

      processor.request('res://a');

      expect(failedHandler).toHaveBeenCalledTimes(1);
      expect((failedHandler.mock.calls[0]![1] as Error).message).toContain('No fetch mode configured');
      expect(processor.isLoading('res://a')).toBe(false);
    });
  });

  describe('pin / unpin (reference counting)', () => {
    it('a pinned entry is not evicted even when it is the LRU candidate', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
        dispose,
        maxEntries: 2,
      });

      processor.request('res://a');
      await flush();
      processor.request('res://b');
      await flush();

      processor.pin('res://a'); // protect 'a' from eviction

      processor.request('res://c');
      await flush(); // 'a' is LRU but pinned -> 'b' is evicted instead

      expect(processor.isCached('res://a')).toBe(true);
      expect(processor.isCached('res://b')).toBe(false);
      expect(processor.isCached('res://c')).toBe(true);
      expect(dispose).toHaveBeenCalledWith('direct:res://b');
      expect(dispose).not.toHaveBeenCalledWith('direct:res://a');
    });

    it('after unpin the entry becomes evictable again', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
        dispose,
        maxEntries: 2,
      });

      processor.request('res://a');
      await flush();
      processor.request('res://b');
      await flush();
      processor.pin('res://a');
      processor.unpin('res://a'); // count back to 0

      processor.request('res://c');
      await flush(); // 'a' is LRU and unpinned -> evicted

      expect(processor.isCached('res://a')).toBe(false);
      expect(dispose).toHaveBeenCalledWith('direct:res://a');
    });

    it('when all cached entries are pinned, the cache temporarily grows beyond maxEntries', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
        dispose,
        maxEntries: 2,
      });

      processor.request('res://a');
      await flush();
      processor.request('res://b');
      await flush();
      processor.pin('res://a');
      processor.pin('res://b');

      processor.request('res://c');
      await flush(); // both pinned: no eviction, size temporarily = 3

      expect(processor.getCacheSize()).toBe(3);
      expect(dispose).not.toHaveBeenCalled();
    });

    it('unpin does NOT dispose the entry — it stays in cache until LRU eviction', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
        dispose,
        maxEntries: 5,
      });

      processor.request('res://a');
      await flush();
      processor.pin('res://a');
      processor.unpin('res://a'); // count = 0, but still in cache

      expect(processor.isCached('res://a')).toBe(true);
      expect(dispose).not.toHaveBeenCalled();
    });

    it('pin survives clearCache(path) — the re-loaded entry is still protected (late-arrival flow)', async () => {
      const dispose = vi.fn();
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `direct:${path}`,
        dispose,
        maxEntries: 2,
      });

      processor.request('res://a');
      await flush();
      processor.pin('res://a'); // mounted consumer

      // Host invalidation + re-request while the consumer stays mounted
      // (the provideFile hot-reload flow).
      processor.clearCache('res://a');
      processor.request('res://a');
      await flush();

      // The value the still-mounted consumer holds must survive the
      // invalidation: disposing it out from under the mesh would hand it a
      // dead resource. It stays deferred while the pin is held.
      expect(dispose).not.toHaveBeenCalled();

      processor.request('res://b');
      await flush();
      processor.request('res://c');
      await flush(); // overflow: 'a' is the LRU candidate but must stay pinned

      expect(processor.isCached('res://a')).toBe(true);
      expect(processor.isCached('res://b')).toBe(false);
      expect(processor.isCached('res://c')).toBe(true);
      // 'b' is legitimately capacity-evicted, but the pinned 'a' value is
      // never disposed while its consumer stays mounted.
      expect(dispose).not.toHaveBeenCalledWith('direct:res://a');
    });

    it('re-request after clearCache while pinned: old value disposed on unpin, new value untouched', async () => {
      // A re-loaded THREE resource is a distinct instance, so each load returns a
      // fresh object: a string is `Object.is`-equal across reloads and masks identity.
      const dispose = vi.fn();
      let version = 0;
      const processor = createResourceProcessor<{ path: string; version: number }>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => ({ path, version: version++ }),
        dispose,
        maxEntries: 3,
      });

      processor.request('res://a');
      await flush();
      const first = processor.getCached('res://a');
      processor.pin('res://a'); // mounted consumer holds `first`

      // Hot-reload: invalidate, then a distinct new value lands at the same path.
      processor.clearCache('res://a');
      processor.request('res://a');
      await flush();
      const second = processor.getCached('res://a');

      expect(second).not.toBe(first); // a new instance is cached
      expect(dispose).not.toHaveBeenCalled(); // still pinned: nothing released

      processor.unpin('res://a'); // last consumer unmounts

      // Only the superseded value is disposed; the live re-loaded value stays.
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(dispose).toHaveBeenCalledWith(first);
      expect(dispose).not.toHaveBeenCalledWith(second);
      expect(processor.getCached('res://a')).toBe(second);
    });
  });

  describe('full-clear invalidation (corpus switch)', () => {
    it("a full clear emits no invalidated, since announcing is the loader's job, and cachedPaths snapshots keys", async () => {
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async (path) => `v:${path}`,
      });
      const invalidated: string[] = [];
      eventBus.on('resource', 'invalidated', (id) => invalidated.push(id));

      processor.request('res://a');
      processor.request('res://b');
      await flush();
      expect(processor.cachedPaths()).toEqual(['res://a', 'res://b']);

      processor.clearCache();
      expect(invalidated).toEqual([]);
      expect(processor.getCacheSize()).toBe(0);
      expect(processor.cachedPaths()).toEqual([]);
    });
  });

  describe('per-path clear (Dependency hot-reload)', () => {
    const createDirect = () =>
      createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        addressesSubResources: true,
        loadDirectly: async (path) => `v:${path}`,
      });

    it('announces the cleared file key, so its mounted consumer requests it again', async () => {
      const processor = createDirect();
      const invalidated: string[] = [];
      eventBus.on('resource', 'invalidated', (id) => invalidated.push(id));
      processor.request('res://a');
      processor.request('res://b');
      await flush();

      processor.clearCache('res://a');

      expect(invalidated).toEqual(['res://a']);
      expect(processor.getCached('res://a')).toBeUndefined();
      expect(processor.getCached('res://b')).toBe('v:res://b');
    });

    it('announces an in-flight file key and disowns its flight', async () => {
      let release!: (value: string) => void;
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: () => new Promise<string>((r) => (release = r)),
      });
      const invalidated: string[] = [];
      eventBus.on('resource', 'invalidated', (id) => invalidated.push(id));
      processor.request('res://a');

      processor.clearCache('res://a');
      release('stale');
      await flush();

      expect(invalidated).toEqual(['res://a']);
      expect(processor.getCached('res://a')).toBeUndefined();
    });

    it('clears and announces only the one key when given an address', async () => {
      const processor = createDirect();
      const invalidated: string[] = [];
      eventBus.on('resource', 'invalidated', (id) => invalidated.push(id));
      processor.request('res://t.tres');
      processor.request('res://t.tres::Font_1');
      processor.request('res://t.tres::Font_2');
      await flush();

      processor.clearCache('res://t.tres::Font_1');

      expect(invalidated).toEqual(['res://t.tres::Font_1']);
      expect(processor.getCached('res://t.tres')).toBe('v:res://t.tres');
      expect(processor.getCached('res://t.tres::Font_2')).toBe('v:res://t.tres::Font_2');
    });

    it('announces the path even when it no longer holds it, since an unpinned failure may have been evicted', () => {
      const processor = createDirect();
      const invalidated: string[] = [];
      eventBus.on('resource', 'invalidated', (id) => invalidated.push(id));

      processor.clearCache('res://evicted.tres');

      expect(invalidated).toEqual(['res://evicted.tres']);
    });

    it('a direct load resolving after a full clear is dropped: not cached, not announced, disposed', async () => {
      let release!: (value: string) => void;
      const gate = new Promise<string>((r) => (release = r));
      const dispose = vi.fn();
      // First request hangs on the gate (the cleared-era fetch); later
      // requests resolve immediately with fresh content.
      let calls = 0;
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async () => (++calls === 1 ? gate : 'fresh'),
        dispose,
      });
      const loaded = vi.fn();
      eventBus.on('resource', 'loaded', loaded);

      processor.request('res://a'); // cleared-era flight departs
      processor.clearCache(); // corpus switch lands mid-flight
      release('stale');
      await flush();

      expect(loaded).not.toHaveBeenCalled();
      expect(processor.isCached('res://a')).toBe(false);
      expect(dispose).toHaveBeenCalledWith('stale');

      // A post-clear request starts a fresh load under the new generation.
      processor.request('res://a');
      await flush();
      expect(loaded).toHaveBeenCalledTimes(1);
      expect(processor.getCached('res://a')).toBe('fresh');
    });

    it('a per-path clear + re-request (hot-reload) never lets the superseded flight overwrite the fresh result', async () => {
      let releaseStale!: (value: string) => void;
      const gate = new Promise<string>((r) => (releaseStale = r));
      let calls = 0;
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async () => (++calls === 1 ? gate : 'fresh'),
      });
      const loaded = vi.fn();
      eventBus.on('resource', 'loaded', loaded);

      processor.request('res://a'); // save 1: slow flight departs
      processor.clearCache('res://a'); // save 2: hot-reload clears the path
      processor.request('res://a'); // reload flight, resolves fast
      await flush();
      expect(processor.getCached('res://a')).toBe('fresh');

      releaseStale('stale'); // the superseded flight finally resolves
      await flush();

      expect(processor.getCached('res://a')).toBe('fresh'); // never overwritten
      expect(loaded).toHaveBeenCalledTimes(1);
      expect(loaded).toHaveBeenCalledWith('res://a', 'fresh');
    });

    it('a stale failure after a full clear is dropped instead of caching a failure', async () => {
      let reject!: (err: Error) => void;
      const gate = new Promise<string>((_r, rj) => (reject = rj));
      let calls = 0;
      const processor = createResourceProcessor<string>({
        eventBus,
        resourceType: 'resource',
        loadDirectly: async () => (++calls === 1 ? gate : 'fresh'),
      });
      const failed = vi.fn();
      eventBus.on('resource', 'failed', failed);

      processor.request('res://a');
      processor.clearCache();
      reject(new Error('old-corpus 404'));
      await flush();

      expect(failed).not.toHaveBeenCalled();
      expect(processor.isCached('res://a')).toBe(false); // no cached failure

      processor.request('res://a');
      await flush();
      expect(processor.getCached('res://a')).toBe('fresh');
    });
  });
});

describe('release', () => {
  function loadedProcessor(load: () => Promise<string>) {
    const eventBus = new ResourceEventBus();
    const processor = createResourceProcessor<string>({
      eventBus,
      resourceType: 'resource',
      loadDirectly: load,
    });
    const invalidated = vi.fn();
    eventBus.on('resource', 'invalidated', invalidated);
    return { eventBus, processor, invalidated };
  }

  /** Request `path` and wait until it loads or fails. A failure rejects `once`, which is the settling. */
  async function settle(eventBus: ResourceEventBus, processor: ResourceProcessor<string>, path: string) {
    const loaded = eventBus.once('resource', 'loaded', path, 1000);
    processor.request(path);
    await loaded.catch(() => undefined);
  }

  it('drops an unpinned value and announces nothing', async () => {
    const { eventBus, processor, invalidated } = loadedProcessor(async () => 'parsed');
    await settle(eventBus, processor, 'res://a.tres');

    processor.release('res://a.tres');

    expect(processor.isCached('res://a.tres')).toBe(false);
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('keeps a value a reader pins', async () => {
    const { eventBus, processor } = loadedProcessor(async () => 'parsed');
    processor.pin('res://a.tres');
    await settle(eventBus, processor, 'res://a.tres');

    processor.release('res://a.tres');

    expect(processor.getCached('res://a.tres')).toBe('parsed');
  });

  it('keeps a failure, so the path is not retried', async () => {
    const { eventBus, processor } = loadedProcessor(async () => {
      throw new Error('missing [gd_resource] header');
    });
    await settle(eventBus, processor, 'res://a.tres');

    processor.release('res://a.tres');

    expect(processor.failure('res://a.tres')?.message).toBe('missing [gd_resource] header');
  });
});
