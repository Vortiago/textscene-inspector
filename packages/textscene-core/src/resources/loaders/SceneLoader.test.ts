import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SceneLoader } from './SceneLoader';
import { ResourceEventBus } from '../ResourceEventBus';
import type { ResourceProvider } from '../ResourceProvider';
import type { TscnScene } from '../../parser/types';

// Minimal valid TSCN content for testing
const VALID_TSCN_CONTENT = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

describe('SceneLoader', () => {
  let eventBus: ResourceEventBus;
  let loader: SceneLoader;
  let mockProvider: ResourceProvider;

  beforeEach(() => {
    eventBus = new ResourceEventBus();

    mockProvider = {
      loadResource: vi.fn().mockResolvedValue(VALID_TSCN_CONTENT),
    };

    loader = new SceneLoader(eventBus, mockProvider);
  });

  afterEach(() => {
    eventBus.clear();
    loader.clearAllCache();
    vi.restoreAllMocks();
  });

  describe('registerMetadata', () => {
    it('registers scene metadata for lookup by ID', () => {
      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      const metadata = loader.getMetadata('scene1');
      expect(metadata).toEqual({
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });
    });

    it('registers scene metadata for lookup by path', () => {
      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      const metadata = loader.getMetadata('res://scenes/room.tscn');
      expect(metadata).toEqual({
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });
    });

    it('provides path to ID mapping', () => {
      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      expect(loader.getIdForPath('res://scenes/room.tscn')).toBe('scene1');
    });
  });

  describe('request', () => {
    it('emits requested event when load initiated', () => {
      const handler = vi.fn();
      eventBus.on('scene', 'requested', handler);

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');

      expect(handler).toHaveBeenCalledWith('scene1', undefined);
    });

    it('emits loading event during load', async () => {
      const handler = vi.fn();
      eventBus.on('scene', 'loading', handler);

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith('scene1', undefined);
    });

    it('emits loaded event with parsed scene on success', async () => {
      const handler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', handler);

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalled();
      const [id, scene] = handler.mock.calls[0];
      expect(id).toBe('scene1');
      expect(scene).toBeDefined();
      expect(scene.nodes).toBeDefined();
      expect(scene.nodes.length).toBe(1);
      expect(scene.nodes[0].name).toBe('Root');
    });

    it('emits loaded event immediately for cached scenes', async () => {
      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      // First load to populate cache
      loader.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Now request again - should emit immediately
      const handler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', handler);

      loader.request('scene1');

      // Should be synchronous for cached
      expect(handler).toHaveBeenCalled();
    });

    it('deduplicates concurrent requests', async () => {
      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      // Request same scene multiple times
      loader.request('scene1');
      loader.request('scene1');
      loader.request('scene1');

      // Should only call provider once
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockProvider.loadResource).toHaveBeenCalledTimes(1);
    });

    it('emits failed event when metadata not found', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);

      loader.request('nonexistent');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
      const [id, error] = handler.mock.calls[0];
      expect(id).toBe('nonexistent');
      expect(error.message).toContain('metadata not found');
    });

    it('emits failed event when provider fails', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);

      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Network error'));

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalled();
      const [id, error] = handler.mock.calls[0];
      expect(id).toBe('scene1');
      expect(error.message).toBe('Network error');
    });

    it('emits failed for previously failed scenes from cache', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Initial fail'));

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      // First request fails
      loader.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Reset handler
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);

      // Second request should emit failed from cache
      loader.request('scene1');

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0]).toBe('scene1');
    });
  });

  describe('cache management', () => {
    it('isCached returns correct status', async () => {
      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      expect(loader.isCached('scene1')).toBe(false);

      loader.request('scene1');
      await eventBus.once<TscnScene>('scene', 'loaded', 'scene1');

      expect(loader.isCached('scene1')).toBe(true);
    });

    it('clearCache removes specific scene', async () => {
      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');
      await eventBus.once<TscnScene>('scene', 'loaded', 'scene1');
      expect(loader.isCached('scene1')).toBe(true);

      loader.clearCache('scene1');
      expect(loader.isCached('scene1')).toBe(false);
    });

    it('clearAllCache removes all scenes', async () => {
      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });
      loader.registerMetadata('scene2', {
        id: 'scene2',
        path: 'res://scenes/hallway.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');
      loader.request('scene2');
      await Promise.all([
        eventBus.once<TscnScene>('scene', 'loaded', 'scene1'),
        eventBus.once<TscnScene>('scene', 'loaded', 'scene2'),
      ]);

      expect(loader.getCacheSize()).toBe(2);

      loader.clearAllCache();

      expect(loader.getCacheSize()).toBe(0);
    });
  });

  describe('isLoading', () => {
    it('returns true while loading', () => {
      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      expect(loader.isLoading('scene1')).toBe(false);

      loader.request('scene1');

      expect(loader.isLoading('scene1')).toBe(true);
    });

    it('returns false after loading completes', async () => {
      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loader.isLoading('scene1')).toBe(false);
    });
  });

  describe('provider management', () => {
    it('can set provider after construction', async () => {
      const loaderNoProvider = new SceneLoader(eventBus, null);

      loaderNoProvider.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      // Request will fail without provider
      const failHandler = vi.fn();
      eventBus.on<Error>('scene', 'failed', failHandler);

      loaderNoProvider.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(failHandler).toHaveBeenCalled();

      // Now set provider and clear cache
      loaderNoProvider.clearCache('scene1');
      loaderNoProvider.setProvider(mockProvider);

      // Request should succeed
      const loadedHandler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', loadedHandler);

      loaderNoProvider.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loadedHandler).toHaveBeenCalled();
    });
  });

  describe('type validation', () => {
    it('rejects non-PackedScene resource types', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      loader.request('tex1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalled();
      const error = handler.mock.calls[0][1] as Error;
      expect(error.message).toContain('Not a PackedScene resource');
    });
  });

  describe('content validation', () => {
    it('fails when content is not a string', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);

      mockProvider.loadResource = vi.fn().mockResolvedValue(new ArrayBuffer(8));

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalled();
      const error = handler.mock.calls[0][1] as Error;
      expect(error.message).toContain('must be text content');
    });
  });

  describe('getCached()', () => {
    it('should return undefined for never-requested ID', () => {
      expect(loader.getCached('nonexistent')).toBeUndefined();
    });

    it('should return scene after successful load', async () => {
      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');
      await eventBus.once<TscnScene>('scene', 'loaded', 'scene1');

      const cached = loader.getCached('scene1');
      expect(cached).toBeDefined();
      expect(cached!.nodes).toBeDefined();
    });

    it('should return null for failed load (cached failure)', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Fail'));

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');
      // Wait for failure event
      await new Promise((resolve) => setTimeout(resolve, 50));

      const cached = loader.getCached('scene1');
      expect(cached).toBeNull();
    });
  });

  describe('clearCache during loading', () => {
    it('should clear inflight set when clearCache called while loading', async () => {
      // Slow provider to ensure we can clear during load
      mockProvider.loadResource = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(VALID_TSCN_CONTENT), 100))
      );

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');
      expect(loader.isLoading('scene1')).toBe(true);

      loader.clearCache('scene1');
      expect(loader.isLoading('scene1')).toBe(false);
    });

    it('should allow new request after clearing during load', async () => {
      let resolveFirst: (value: string) => void;
      const firstPromise = new Promise<string>((resolve) => {
        resolveFirst = resolve;
      });

      mockProvider.loadResource = vi.fn().mockReturnValue(firstPromise);

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      // Start first request
      loader.request('scene1');
      expect(loader.isLoading('scene1')).toBe(true);

      // Clear while loading
      loader.clearCache('scene1');
      expect(loader.isLoading('scene1')).toBe(false);

      // New request should be allowed
      mockProvider.loadResource = vi.fn().mockResolvedValue(VALID_TSCN_CONTENT);
      loader.request('scene1');
      expect(loader.isLoading('scene1')).toBe(true);

      // Resolve first promise (should not affect anything since cleared)
      resolveFirst!(VALID_TSCN_CONTENT);

      // Wait for second request to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(loader.isCached('scene1')).toBe(true);
    });
  });

  describe('reload after failure', () => {
    it('should successfully reload after clearing failed cache', async () => {
      // First load fails
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Network error'));

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(loader.getCached('scene1')).toBeNull();

      // Clear failed cache
      loader.clearCache('scene1');

      // Second load succeeds
      mockProvider.loadResource = vi.fn().mockResolvedValue(VALID_TSCN_CONTENT);

      loader.request('scene1');
      const scene = await eventBus.once<TscnScene>('scene', 'loaded', 'scene1');
      expect(scene).toBeDefined();
      expect(scene!.nodes).toBeDefined();
    });

    it('should emit loaded event on successful reload', async () => {
      // First load fails
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Network error'));

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      loader.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Clear and setup success
      loader.clearCache('scene1');
      mockProvider.loadResource = vi.fn().mockResolvedValue(VALID_TSCN_CONTENT);

      const handler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', handler);

      loader.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalled();
      const [id, scene] = handler.mock.calls[0];
      expect(id).toBe('scene1');
      expect(scene.nodes).toBeDefined();
    });
  });

  describe('lenient parsing behavior', () => {
    // Note: TscnParser is a lenient parser designed to recover from errors
    // rather than fail. These tests verify the lenient behavior.

    it('should return empty scene for empty content (lenient)', async () => {
      mockProvider.loadResource = vi.fn().mockResolvedValue('');

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      const loadedHandler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', loadedHandler);

      loader.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Lenient parser emits loaded with empty nodes array
      expect(loadedHandler).toHaveBeenCalled();
      const [id, scene] = loadedHandler.mock.calls[0];
      expect(id).toBe('scene1');
      expect(scene.nodes).toBeDefined();
    });

    it('should handle invalid content gracefully (lenient)', async () => {
      mockProvider.loadResource = vi.fn().mockResolvedValue('not valid tscn content');

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      const loadedHandler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', loadedHandler);

      loader.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Lenient parser returns what it can parse
      expect(loadedHandler).toHaveBeenCalled();
    });

    it('should handle minimal header gracefully (lenient)', async () => {
      // Missing format parameter - lenient parser should still work
      mockProvider.loadResource = vi.fn().mockResolvedValue('[gd_scene]\n[node name="Root" type="Node3D"]');

      loader.registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      const loadedHandler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', loadedHandler);

      loader.request('scene1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Lenient parser recovers and parses what it can
      expect(loadedHandler).toHaveBeenCalled();
    });
  });
});
