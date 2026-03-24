import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import * as THREE from 'three';
import { TextureLoader } from './TextureLoader';
import { ResourceEventBus } from '../ResourceEventBus';
import type { ResourceProvider } from '../ResourceProvider';

describe('TextureLoader', () => {
  let eventBus: ResourceEventBus;
  let loader: TextureLoader;
  let mockProvider: ResourceProvider;
  let getMimeType: (path: string) => string;

  // Store original and mock texture loader
  let textureLoaderLoadSpy: MockInstance;

  beforeEach(() => {
    eventBus = new ResourceEventBus();

    mockProvider = {
      loadResource: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    getMimeType = vi.fn((path: string) => {
      const ext = path.split('.').pop()?.toLowerCase();
      return ext === 'png' ? 'image/png' : 'application/octet-stream';
    });

    // Mock URL APIs
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();

    // Mock THREE.TextureLoader.prototype.load to immediately call success
    textureLoaderLoadSpy = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(
      function (
        this: THREE.TextureLoader,
        _url: string,
        onLoad?: (texture: THREE.Texture) => void
      ): THREE.Texture {
        const mockTexture = new THREE.Texture();
        mockTexture.name = 'mock-texture';
        if (onLoad) {
          // Call onLoad asynchronously to simulate real behavior
          setTimeout(() => onLoad(mockTexture), 1);
        }
        return mockTexture;
      }
    );

    loader = new TextureLoader(eventBus, mockProvider, getMimeType);
  });

  afterEach(() => {
    eventBus.clear();
    loader.clearAllCache();
    textureLoaderLoadSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('registerMetadata', () => {
    it('registers texture metadata for lookup', () => {
      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      const metadata = loader.getMetadata('tex1');
      expect(metadata).toEqual({
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });
    });
  });

  describe('request', () => {
    it('emits requested event when load initiated', () => {
      const handler = vi.fn();
      eventBus.on('texture', 'requested', handler);

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      loader.request('tex1');

      expect(handler).toHaveBeenCalledWith('tex1', undefined);
    });

    it('emits loading event during load', async () => {
      const handler = vi.fn();
      eventBus.on('texture', 'loading', handler);

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      loader.request('tex1');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith('tex1', undefined);
    });

    it('emits loaded event with texture on success', async () => {
      const handler = vi.fn();
      eventBus.on<THREE.Texture>('texture', 'loaded', handler);

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      loader.request('tex1');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalled();
      const [id, texture] = handler.mock.calls[0];
      expect(id).toBe('tex1');
      expect(texture).toBeInstanceOf(THREE.Texture);
    });

    it('emits loaded event immediately for cached textures', async () => {
      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      // First load to populate cache
      loader.request('tex1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Now request again - should emit immediately
      const handler = vi.fn();
      eventBus.on<THREE.Texture>('texture', 'loaded', handler);

      loader.request('tex1');

      // Should be synchronous for cached
      expect(handler).toHaveBeenCalled();
    });

    it('deduplicates concurrent requests', async () => {
      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      // Request same texture multiple times
      loader.request('tex1');
      loader.request('tex1');
      loader.request('tex1');

      // Should only call provider once
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockProvider.loadResource).toHaveBeenCalledTimes(1);
    });

    it('emits failed event when metadata not found', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('texture', 'failed', handler);

      loader.request('nonexistent');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
      const [id, error] = handler.mock.calls[0];
      expect(id).toBe('nonexistent');
      expect(error.message).toContain('metadata not found');
    });

    it('emits failed event when provider fails', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('texture', 'failed', handler);

      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Network error'));

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      loader.request('tex1');

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalled();
      const [id, error] = handler.mock.calls[0];
      expect(id).toBe('tex1');
      expect(error.message).toBe('Network error');
    });

    it('emits failed for previously failed textures from cache', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Initial fail'));

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      // First request fails
      loader.request('tex1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Reset handler
      const handler = vi.fn();
      eventBus.on<Error>('texture', 'failed', handler);

      // Second request should emit failed from cache
      loader.request('tex1');

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0]).toBe('tex1');
    });
  });

  describe('load (promise API)', () => {
    it('returns texture on success', async () => {
      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      const texture = await loader.load('tex1');

      expect(texture).toBeInstanceOf(THREE.Texture);
    });

    it('returns null on failure', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Fail'));

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      const texture = await loader.load('tex1');

      expect(texture).toBeNull();
    });

    it('returns cached texture immediately', async () => {
      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      // First load
      await loader.load('tex1');

      // Second load should be instant
      const start = performance.now();
      await loader.load('tex1');
      const elapsed = performance.now() - start;

      // Should be very fast (< 5ms) since it's cached
      expect(elapsed).toBeLessThan(10);
      expect(mockProvider.loadResource).toHaveBeenCalledTimes(1);
    });

    it('returns null for previously-failed texture without hanging', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Network error'));

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      // First load fails and caches null
      const first = await loader.load('tex1');
      expect(first).toBeNull();

      // Second load must resolve (not hang) even though request() emits failed synchronously
      const second = await loader.load('tex1');
      expect(second).toBeNull();
    });
  });

  describe('cache management', () => {
    it('isCached returns correct status', async () => {
      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      expect(loader.isCached('tex1')).toBe(false);

      await loader.load('tex1');

      expect(loader.isCached('tex1')).toBe(true);
    });

    it('clearCache removes specific texture', async () => {
      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      await loader.load('tex1');
      expect(loader.isCached('tex1')).toBe(true);

      loader.clearCache('tex1');
      expect(loader.isCached('tex1')).toBe(false);
    });

    it('clearAllCache removes all textures', async () => {
      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });
      loader.registerMetadata('tex2', {
        id: 'tex2',
        path: 'res://textures/normal.png',
        type: 'Texture2D',
      });

      await Promise.all([loader.load('tex1'), loader.load('tex2')]);

      expect(loader.getCacheSize()).toBe(2);

      loader.clearAllCache();

      expect(loader.getCacheSize()).toBe(0);
    });
  });

  describe('isLoading', () => {
    it('returns true while loading', () => {
      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      expect(loader.isLoading('tex1')).toBe(false);

      loader.request('tex1');

      expect(loader.isLoading('tex1')).toBe(true);
    });

    it('returns false after loading completes', async () => {
      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      loader.request('tex1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loader.isLoading('tex1')).toBe(false);
    });
  });

  describe('provider management', () => {
    it('can set provider after construction', async () => {
      const loaderNoProvider = new TextureLoader(eventBus, null, getMimeType);

      loaderNoProvider.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      // Request will fail without provider
      const failHandler = vi.fn();
      eventBus.on<Error>('texture', 'failed', failHandler);

      loaderNoProvider.request('tex1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(failHandler).toHaveBeenCalled();

      // Now set provider and clear cache
      loaderNoProvider.clearCache('tex1');
      loaderNoProvider.setProvider(mockProvider);

      // Request should succeed
      const loadedHandler = vi.fn();
      eventBus.on<THREE.Texture>('texture', 'loaded', loadedHandler);

      loaderNoProvider.request('tex1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loadedHandler).toHaveBeenCalled();
    });
  });

  describe('type validation', () => {
    it('rejects non-texture resource types', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('texture', 'failed', handler);

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/wood.tres',
        type: 'StandardMaterial3D',
      });

      loader.request('mat1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalled();
      const error = handler.mock.calls[0][1] as Error;
      expect(error.message).toContain('Not a texture resource');
    });
  });

  describe('failed texture tracking', () => {
    it('tracks failed textures', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Load failed'));

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/missing.png',
        type: 'Texture2D',
      });

      loader.request('tex1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(loader.hasFailed('tex1')).toBe(true);
      const failed = loader.getFailedTextures();
      expect(failed.get('tex1')).toBeDefined();
      expect(failed.get('tex1')?.path).toBe('res://textures/missing.png');
    });

    it('retryFailed clears failed status and re-requests', async () => {
      // First request fails
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Load failed'));

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/retry.png',
        type: 'Texture2D',
      });

      loader.request('tex1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(loader.hasFailed('tex1')).toBe(true);

      // Fix provider and retry
      mockProvider.loadResource = vi.fn().mockResolvedValue(new ArrayBuffer(8));

      const loadedHandler = vi.fn();
      eventBus.on<THREE.Texture>('texture', 'loaded', loadedHandler);

      loader.retryFailed('tex1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loader.hasFailed('tex1')).toBe(false);
      expect(loadedHandler).toHaveBeenCalled();
    });

    it('auto-retries when resource:provided event fires', async () => {
      // First request fails
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Load failed'));

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/wall.png',
        type: 'Texture2D',
      });

      loader.request('tex1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(loader.hasFailed('tex1')).toBe(true);

      // Fix provider
      mockProvider.loadResource = vi.fn().mockResolvedValue(new ArrayBuffer(8));

      const loadedHandler = vi.fn();
      eventBus.on<THREE.Texture>('texture', 'loaded', loadedHandler);

      // Emit resource:provided event
      eventBus.emit<string>('resource', 'provided', 'res://textures/wall.png', 'res://textures/wall.png');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loader.hasFailed('tex1')).toBe(false);
      expect(loadedHandler).toHaveBeenCalled();
    });

    it('only retries textures with matching path', async () => {
      // Setup two failed textures
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Load failed'));

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/wall.png',
        type: 'Texture2D',
      });
      loader.registerMetadata('tex2', {
        id: 'tex2',
        path: 'res://textures/floor.png',
        type: 'Texture2D',
      });

      loader.request('tex1');
      loader.request('tex2');
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(loader.hasFailed('tex1')).toBe(true);
      expect(loader.hasFailed('tex2')).toBe(true);

      // Fix provider
      mockProvider.loadResource = vi.fn().mockResolvedValue(new ArrayBuffer(8));

      // Emit provided event for only wall.png
      eventBus.emit<string>('resource', 'provided', 'res://textures/wall.png');

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Only tex1 should have been retried
      expect(loader.hasFailed('tex1')).toBe(false);
      expect(loader.hasFailed('tex2')).toBe(true);
    });

    it('clearAllCache also clears failed textures', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Load failed'));

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/missing.png',
        type: 'Texture2D',
      });

      loader.request('tex1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(loader.hasFailed('tex1')).toBe(true);

      loader.clearAllCache();

      expect(loader.hasFailed('tex1')).toBe(false);
      expect(loader.getFailedTextures().size).toBe(0);
    });
  });
});
