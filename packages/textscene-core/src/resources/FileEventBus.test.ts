import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileEventBus } from './FileEventBus.js';
import type { ResourceProvider } from './ResourceProvider.js';

describe('FileEventBus', () => {
  let mockProvider: ResourceProvider;
  let eventBus: FileEventBus;

  beforeEach(() => {
    mockProvider = {
      loadResource: vi.fn(),
    };
    eventBus = new FileEventBus(mockProvider);
  });

  describe('request()', () => {
    it('emits loaded event when file loads successfully', async () => {
      const handler = vi.fn();
      eventBus.on('loaded', handler);

      vi.mocked(mockProvider.loadResource).mockResolvedValue('file content');

      eventBus.request('res://test.tscn');

      // Wait for async load
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith('res://test.tscn', 'file content');
      });
    });

    it('emits failed event when file fails to load', async () => {
      const loadedHandler = vi.fn();
      const failedHandler = vi.fn();
      eventBus.on('loaded', loadedHandler);
      eventBus.on('failed', failedHandler);

      vi.mocked(mockProvider.loadResource).mockRejectedValue(new Error('File not found'));

      eventBus.request('res://missing.tscn');

      await vi.waitFor(() => {
        expect(failedHandler).toHaveBeenCalled();
      });

      expect(loadedHandler).not.toHaveBeenCalled();
      expect(failedHandler.mock.calls[0][0]).toBe('res://missing.tscn');
      expect(failedHandler.mock.calls[0][1]).toBeInstanceOf(Error);
    });

    it('emits failed event when provider returns null', async () => {
      const failedHandler = vi.fn();
      eventBus.on('failed', failedHandler);

      vi.mocked(mockProvider.loadResource).mockResolvedValue(null);

      eventBus.request('res://null.tscn');

      await vi.waitFor(() => {
        expect(failedHandler).toHaveBeenCalled();
      });

      expect(failedHandler.mock.calls[0][1].message).toContain('File not found');
    });

    it('caches loaded files', async () => {
      const handler = vi.fn();
      eventBus.on('loaded', handler);

      vi.mocked(mockProvider.loadResource).mockResolvedValue('cached content');

      // First request
      eventBus.request('res://cached.tscn');
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });

      // Second request - should hit cache
      eventBus.request('res://cached.tscn');
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(2);
      });

      // Provider should only be called once
      expect(mockProvider.loadResource).toHaveBeenCalledTimes(1);
    });

    it('deduplicates in-flight requests', async () => {
      const handler = vi.fn();
      eventBus.on('loaded', handler);

      let resolveLoad: (value: string) => void;
      vi.mocked(mockProvider.loadResource).mockImplementation(
        () => new Promise((resolve) => { resolveLoad = resolve; })
      );

      // Multiple simultaneous requests
      eventBus.request('res://slow.tscn');
      eventBus.request('res://slow.tscn');
      eventBus.request('res://slow.tscn');

      // Resolve the single load
      resolveLoad!('content');

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });

      // Provider should only be called once
      expect(mockProvider.loadResource).toHaveBeenCalledTimes(1);
    });
  });

  describe('on() / off()', () => {
    it('allows subscribing and unsubscribing from loaded events', async () => {
      const handler = vi.fn();
      eventBus.on('loaded', handler);

      vi.mocked(mockProvider.loadResource).mockResolvedValue('content');

      eventBus.request('res://test1.tscn');
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });

      // Unsubscribe
      eventBus.off('loaded', handler);
      eventBus.clearCache('res://test2.tscn');

      eventBus.request('res://test2.tscn');
      await vi.waitFor(() => {
        expect(mockProvider.loadResource).toHaveBeenCalledTimes(2);
      });

      // Handler should not be called again
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('allows multiple handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on('loaded', handler1);
      eventBus.on('loaded', handler2);

      vi.mocked(mockProvider.loadResource).mockResolvedValue('content');

      eventBus.request('res://test.tscn');

      await vi.waitFor(() => {
        expect(handler1).toHaveBeenCalled();
        expect(handler2).toHaveBeenCalled();
      });
    });
  });

  describe('clearCache()', () => {
    it('clears specific file from cache', async () => {
      const handler = vi.fn();
      eventBus.on('loaded', handler);

      vi.mocked(mockProvider.loadResource).mockResolvedValue('content');

      eventBus.request('res://test.tscn');
      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledTimes(1);
      });

      expect(eventBus.isCached('res://test.tscn')).toBe(true);

      eventBus.clearCache('res://test.tscn');

      expect(eventBus.isCached('res://test.tscn')).toBe(false);
    });

    it('clears all cache when no path specified', async () => {
      vi.mocked(mockProvider.loadResource).mockResolvedValue('content');

      eventBus.request('res://file1.tscn');
      eventBus.request('res://file2.tscn');

      await vi.waitFor(() => {
        expect(eventBus.getCacheSize()).toBe(2);
      });

      eventBus.clearCache();

      expect(eventBus.getCacheSize()).toBe(0);
    });
  });

  describe('isLoading()', () => {
    it('returns true while file is loading', async () => {
      let resolveLoad: (value: string) => void;
      vi.mocked(mockProvider.loadResource).mockImplementation(
        () => new Promise((resolve) => { resolveLoad = resolve; })
      );

      eventBus.request('res://loading.tscn');

      expect(eventBus.isLoading('res://loading.tscn')).toBe(true);

      resolveLoad!('content');

      await vi.waitFor(() => {
        expect(eventBus.isLoading('res://loading.tscn')).toBe(false);
      });
    });
  });

  describe('getProvider()', () => {
    it('returns the resource provider', () => {
      expect(eventBus.getProvider()).toBe(mockProvider);
    });
  });

  describe('error handling', () => {
    it('continues calling other handlers when one throws', async () => {
      const errorHandler = vi.fn(() => { throw new Error('Handler error'); });
      const normalHandler = vi.fn();

      eventBus.on('loaded', errorHandler);
      eventBus.on('loaded', normalHandler);

      vi.mocked(mockProvider.loadResource).mockResolvedValue('content');

      eventBus.request('res://test.tscn');

      await vi.waitFor(() => {
        expect(normalHandler).toHaveBeenCalled();
      });
    });
  });
});
