import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { MaterialLoader } from './MaterialLoader';
import { ResourceEventBus } from '../ResourceEventBus';
import { ResourceRegistry } from '../ResourceRegistry';
import type { ResourceProvider } from '../ResourceProvider';

describe('MaterialLoader', () => {
  let eventBus: ResourceEventBus;
  let registry: ResourceRegistry;
  let loader: MaterialLoader;
  let mockProvider: ResourceProvider;

  // Valid StandardMaterial3D .tres content
  const validTresContent = `[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(0.8, 0.2, 0.2, 1.0)
metallic = 0.5
roughness = 0.3
`;

  beforeEach(() => {
    eventBus = new ResourceEventBus();
    registry = new ResourceRegistry();

    mockProvider = {
      loadResource: vi.fn().mockResolvedValue(validTresContent),
    };

    registry.setProvider(mockProvider);
    loader = new MaterialLoader(eventBus, mockProvider, registry);
  });

  afterEach(() => {
    eventBus.clear();
    loader.clearAllCache();
    vi.clearAllMocks();
  });

  describe('registerMetadata', () => {
    it('registers material metadata for lookup', () => {
      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      const metadata = loader.getMetadata('mat1');
      expect(metadata).toEqual({
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });
    });
  });

  describe('request', () => {
    it('emits requested event when load initiated', () => {
      const handler = vi.fn();
      eventBus.on('material', 'requested', handler);

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      loader.request('mat1');

      expect(handler).toHaveBeenCalledWith('mat1', undefined);
    });

    it('emits loading event during load', async () => {
      const handler = vi.fn();
      eventBus.on('material', 'loading', handler);

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      loader.request('mat1');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith('mat1', undefined);
    });

    it('emits loaded event with material on success', async () => {
      const handler = vi.fn();
      eventBus.on<THREE.Material>('material', 'loaded', handler);

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      loader.request('mat1');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalled();
      const [id, material] = handler.mock.calls[0];
      expect(id).toBe('mat1');
      expect(material).toBeInstanceOf(THREE.Material);
    });

    it('emits loaded event immediately for cached materials', async () => {
      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      // First load to populate cache
      loader.request('mat1');
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now request again - should emit immediately
      const handler = vi.fn();
      eventBus.on<THREE.Material>('material', 'loaded', handler);

      loader.request('mat1');

      // Should be synchronous for cached
      expect(handler).toHaveBeenCalled();
    });

    it('deduplicates concurrent requests', async () => {
      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      // Request same material multiple times
      loader.request('mat1');
      loader.request('mat1');
      loader.request('mat1');

      // Should only call provider once
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockProvider.loadResource).toHaveBeenCalledTimes(1);
    });

    it('emits failed event when metadata not found', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('material', 'failed', handler);

      loader.request('nonexistent');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
      const [id, error] = handler.mock.calls[0];
      expect(id).toBe('nonexistent');
      expect(error.message).toContain('metadata not found');
    });

    it('emits failed event when provider fails', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('material', 'failed', handler);

      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Network error'));

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      loader.request('mat1');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalled();
      const [id, error] = handler.mock.calls[0];
      expect(id).toBe('mat1');
      expect(error.message).toBe('Network error');
    });
  });

  describe('load (promise API)', () => {
    it('returns material on success', async () => {
      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      const material = await loader.load('mat1');

      expect(material).toBeInstanceOf(THREE.Material);
    });

    it('returns null on failure', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Fail'));

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      const material = await loader.load('mat1');

      expect(material).toBeNull();
    });

    it('returns cached material immediately', async () => {
      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      // First load
      await loader.load('mat1');

      // Second load should be instant
      const start = performance.now();
      await loader.load('mat1');
      const elapsed = performance.now() - start;

      // Should be very fast (< 5ms) since it's cached
      expect(elapsed).toBeLessThan(10);
      expect(mockProvider.loadResource).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache management', () => {
    it('isCached returns correct status', async () => {
      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      expect(loader.isCached('mat1')).toBe(false);

      await loader.load('mat1');

      expect(loader.isCached('mat1')).toBe(true);
    });

    it('clearCache removes specific material', async () => {
      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });

      await loader.load('mat1');
      expect(loader.isCached('mat1')).toBe(true);

      loader.clearCache('mat1');
      expect(loader.isCached('mat1')).toBe(false);
    });

    it('clearAllCache removes all materials', async () => {
      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/red.tres',
        type: 'StandardMaterial3D',
      });
      loader.registerMetadata('mat2', {
        id: 'mat2',
        path: 'res://materials/blue.tres',
        type: 'StandardMaterial3D',
      });

      await Promise.all([loader.load('mat1'), loader.load('mat2')]);

      expect(loader.getCacheSize()).toBe(2);

      loader.clearAllCache();

      expect(loader.getCacheSize()).toBe(0);
    });
  });

  describe('type validation', () => {
    it('rejects non-material resource types', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('material', 'failed', handler);

      loader.registerMetadata('tex1', {
        id: 'tex1',
        path: 'res://textures/albedo.png',
        type: 'Texture2D',
      });

      loader.request('tex1');
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalled();
      const error = handler.mock.calls[0][1] as Error;
      expect(error.message).toContain('Not a material resource');
    });
  });
});
