/**
 * Tests for `createResourceProcessor` — the generic cache + inflight +
 * event-emission factory behind the texture/material/GLB/scene processors.
 *
 * The four concrete processors exercise this loop indirectly (see
 * `processors/createSceneProcessor.test.ts`); this file pins the factory's
 * own contract for BOTH fetch modes: FileEventBus-driven (shouldProcess +
 * process) and direct (loadDirectly).
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
      // The request stays inflight — the design assumes a sibling processor
      // (sharing the FileEventBus) handles data this one rejects.
      expect(processor.isLoading('res://a.bin')).toBe(true);
      expect(processor.isCached('res://a.bin')).toBe(false);
    });

    it('failure is cached as null and a repeat request re-emits failed WITHOUT re-hitting the provider', async () => {
      // Provider has no file -> FileEventBus emits failed -> processor caches null.
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
      expect((failedHandler.mock.calls[1]![1] as Error).message).toContain('previously failed');
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
      expect(sequence).toEqual([
        'requested',
        'loading',
        'loaded:res://scene.tscn:direct:res://scene.tscn',
      ]);
      expect(processor.getCached('res://scene.tscn')).toBe('direct:res://scene.tscn');
    });

    it('failure is cached as null and a repeat request re-emits failed WITHOUT re-invoking loadDirectly', async () => {
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
      expect((failedHandler.mock.calls[1]![1] as Error).message).toContain('previously failed');
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

    it('clearCache(path) invokes the disposer for that resource only', async () => {
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
});
