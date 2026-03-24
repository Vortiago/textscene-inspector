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

      // Wait for async operations (500ms to handle slow CI environments)
      await new Promise((resolve) => setTimeout(resolve, 500));

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
      await new Promise((resolve) => setTimeout(resolve, 500));

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
      await new Promise((resolve) => setTimeout(resolve, 500));

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

  describe('failed material tracking', () => {
    it('tracks failed materials', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Load failed'));

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/missing.tres',
        type: 'StandardMaterial3D',
      });

      loader.request('mat1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loader.hasFailed('mat1')).toBe(true);
      const failed = loader.getFailedMaterials();
      expect(failed.get('mat1')).toBeDefined();
      expect(failed.get('mat1')?.path).toBe('res://materials/missing.tres');
    });

    it('retryFailed clears failed status and re-requests', async () => {
      // First request fails
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Load failed'));

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/retry.tres',
        type: 'StandardMaterial3D',
      });

      loader.request('mat1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loader.hasFailed('mat1')).toBe(true);

      // Fix provider and retry
      mockProvider.loadResource = vi.fn().mockResolvedValue(validTresContent);

      const loadedHandler = vi.fn();
      eventBus.on<THREE.Material>('material', 'loaded', loadedHandler);

      loader.retryFailed('mat1');
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(loader.hasFailed('mat1')).toBe(false);
      expect(loadedHandler).toHaveBeenCalled();
    });

    it('auto-retries when resource:provided event fires', async () => {
      // First request fails
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Load failed'));

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/wood.tres',
        type: 'StandardMaterial3D',
      });

      loader.request('mat1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loader.hasFailed('mat1')).toBe(true);

      // Fix provider
      mockProvider.loadResource = vi.fn().mockResolvedValue(validTresContent);

      const loadedHandler = vi.fn();
      eventBus.on<THREE.Material>('material', 'loaded', loadedHandler);

      // Emit resource:provided event
      eventBus.emit<string>('resource', 'provided', 'res://materials/wood.tres', 'res://materials/wood.tres');

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(loader.hasFailed('mat1')).toBe(false);
      expect(loadedHandler).toHaveBeenCalled();
    });

    it('retries failed materials when texture:loaded event fires', async () => {
      // First request fails (simulating texture dependency failure)
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Texture missing'));

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/textured.tres',
        type: 'StandardMaterial3D',
      });

      loader.request('mat1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loader.hasFailed('mat1')).toBe(true);

      // Fix provider (texture is now available)
      mockProvider.loadResource = vi.fn().mockResolvedValue(validTresContent);

      const loadedHandler = vi.fn();
      eventBus.on<THREE.Material>('material', 'loaded', loadedHandler);

      // Emit texture:loaded event (simulating texture was provided)
      eventBus.emit<THREE.Texture>('texture', 'loaded', 'tex1', new THREE.Texture());

      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(loader.hasFailed('mat1')).toBe(false);
      expect(loadedHandler).toHaveBeenCalled();
    });

    it('clearAllCache also clears failed materials', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Load failed'));

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/missing.tres',
        type: 'StandardMaterial3D',
      });

      loader.request('mat1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loader.hasFailed('mat1')).toBe(true);

      loader.clearAllCache();

      expect(loader.hasFailed('mat1')).toBe(false);
      expect(loader.getFailedMaterials().size).toBe(0);
    });
  });

  describe('targeted texture retry', () => {
    // Material content with texture references that will FAIL parsing
    // Using ShaderMaterial type (not supported) so parsing throws but we can extract texture refs
    const materialWithTextures = `[gd_resource type="ShaderMaterial" format=3]

[resource]
albedo_texture = ExtResource("tex_albedo")
normal_texture = ExtResource("tex_normal")
`;

    const materialWithSingleTexture = `[gd_resource type="ShaderMaterial" format=3]

[resource]
albedo_texture = ExtResource("tex_wall")
`;

    it('extracts texture dependencies when material content is loaded but parsing fails', async () => {
      // Returns content successfully, but parsing fails (ShaderMaterial not supported)
      mockProvider.loadResource = vi.fn().mockResolvedValue(materialWithTextures);

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/textured.tres',
        type: 'ShaderMaterial',
      });

      loader.request('mat1');
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(loader.hasFailed('mat1')).toBe(true);

      // Check that texture dependencies were extracted from the loaded content
      const awaitingTextures = loader.getAwaitingTextures('mat1');
      expect(awaitingTextures.has('tex_albedo')).toBe(true);
      expect(awaitingTextures.has('tex_normal')).toBe(true);
      expect(awaitingTextures.size).toBe(2);
    });

    it('only retries material when its specific texture loads', async () => {
      // Returns content successfully, but parsing fails (ShaderMaterial not supported)
      mockProvider.loadResource = vi.fn().mockResolvedValue(materialWithSingleTexture);

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/wall.tres',
        type: 'ShaderMaterial',
      });

      loader.request('mat1');
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(loader.hasFailed('mat1')).toBe(true);
      expect(loader.getAwaitingTextures('mat1').has('tex_wall')).toBe(true);

      // Emit texture:loaded for DIFFERENT texture - should NOT retry
      eventBus.emit<THREE.Texture>('texture', 'loaded', 'tex_other', new THREE.Texture());
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Material should still be failed (not retried)
      expect(loader.hasFailed('mat1')).toBe(true);

      // Now emit for the CORRECT texture
      mockProvider.loadResource = vi.fn().mockResolvedValue(validTresContent);

      const loadedHandler = vi.fn();
      eventBus.on<THREE.Material>('material', 'loaded', loadedHandler);

      eventBus.emit<THREE.Texture>('texture', 'loaded', 'tex_wall', new THREE.Texture());
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Now it should have retried and succeeded
      expect(loader.hasFailed('mat1')).toBe(false);
      expect(loadedHandler).toHaveBeenCalled();
    });

    it('retries on any texture when no dependencies are known (fallback)', async () => {
      // Provider fails immediately (no content loaded)
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('File not found'));

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/missing.tres',
        type: 'StandardMaterial3D',
      });

      loader.request('mat1');
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loader.hasFailed('mat1')).toBe(true);

      // No awaiting textures (content wasn't loaded)
      const awaitingTextures = loader.getAwaitingTextures('mat1');
      expect(awaitingTextures.size).toBe(0);

      // Any texture:loaded should trigger retry (fallback behavior)
      mockProvider.loadResource = vi.fn().mockResolvedValue(validTresContent);

      const loadedHandler = vi.fn();
      eventBus.on<THREE.Material>('material', 'loaded', loadedHandler);

      eventBus.emit<THREE.Texture>('texture', 'loaded', 'any_texture', new THREE.Texture());
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(loader.hasFailed('mat1')).toBe(false);
      expect(loadedHandler).toHaveBeenCalled();
    });

    it('handles multiple materials with different texture dependencies', async () => {
      // Setup: mat1 needs tex_a, mat2 needs tex_b (both use ShaderMaterial to trigger parsing failure)
      mockProvider.loadResource = vi.fn().mockImplementation((path: string) => {
        if (path.includes('mat1')) {
          return Promise.resolve(`[gd_resource type="ShaderMaterial" format=3]\n[resource]\nalbedo_texture = ExtResource("tex_a")`);
        }
        if (path.includes('mat2')) {
          return Promise.resolve(`[gd_resource type="ShaderMaterial" format=3]\n[resource]\nalbedo_texture = ExtResource("tex_b")`);
        }
        return Promise.reject(new Error('Unknown'));
      });

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/mat1.tres',
        type: 'ShaderMaterial',
      });
      loader.registerMetadata('mat2', {
        id: 'mat2',
        path: 'res://materials/mat2.tres',
        type: 'ShaderMaterial',
      });

      loader.request('mat1');
      loader.request('mat2');
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(loader.hasFailed('mat1')).toBe(true);
      expect(loader.hasFailed('mat2')).toBe(true);
      expect(loader.getAwaitingTextures('mat1').has('tex_a')).toBe(true);
      expect(loader.getAwaitingTextures('mat2').has('tex_b')).toBe(true);

      // Emit tex_a - only mat1 should retry
      mockProvider.loadResource = vi.fn().mockResolvedValue(validTresContent);

      eventBus.emit<THREE.Texture>('texture', 'loaded', 'tex_a', new THREE.Texture());
      await new Promise((resolve) => setTimeout(resolve, 100));

      // mat1 should no longer be failed
      expect(loader.hasFailed('mat1')).toBe(false);
      // mat2 should still be failed (different texture)
      expect(loader.hasFailed('mat2')).toBe(true);
    });

    it('getFailedMaterialsWithDependencies returns full info', async () => {
      // Returns content successfully, but parsing fails (ShaderMaterial not supported)
      mockProvider.loadResource = vi.fn().mockResolvedValue(materialWithTextures);

      loader.registerMetadata('mat1', {
        id: 'mat1',
        path: 'res://materials/test.tres',
        type: 'ShaderMaterial',
      });

      loader.request('mat1');
      await new Promise((resolve) => setTimeout(resolve, 100));

      const failedWithDeps = loader.getFailedMaterialsWithDependencies();
      expect(failedWithDeps.has('mat1')).toBe(true);

      const info = failedWithDeps.get('mat1')!;
      expect(info.metadata.id).toBe('mat1');
      expect(info.metadata.path).toBe('res://materials/test.tres');
      expect(info.awaitingTextures.has('tex_albedo')).toBe(true);
      expect(info.awaitingTextures.has('tex_normal')).toBe(true);
    });
  });
});
