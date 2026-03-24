/**
 * Integration tests for the resource recovery cascade.
 * Tests the full flow: resource:provided → texture loads → material retries → mesh updates
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import * as THREE from 'three';
import { ResourceRegistry } from '../ResourceRegistry';
import type { ResourceProvider } from '../ResourceProvider';
import type { TscnExternalResource } from '../../parser/types';

// Mock THREE.TextureLoader to avoid WebGL context requirement
let textureLoaderLoadSpy: MockInstance;

beforeEach(() => {
  textureLoaderLoadSpy = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(
    function (
      this: THREE.TextureLoader,
      _url: string,
      onLoad?: (texture: THREE.Texture) => void
    ): THREE.Texture {
      const mockTexture = new THREE.Texture();
      mockTexture.name = 'mock-texture';
      if (onLoad) {
        queueMicrotask(() => onLoad(mockTexture));
      }
      return mockTexture;
    }
  );

  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  textureLoaderLoadSpy.mockRestore();
  vi.restoreAllMocks();
});

const validTresContent = `[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(0.8, 0.2, 0.2, 1)
metallic = 0.5
roughness = 0.3
`;

describe('Resource Recovery Integration', () => {
  let registry: ResourceRegistry;
  let mockProvider: ResourceProvider;
  let providerResponses: Map<string, () => Promise<string | ArrayBuffer>>;

  beforeEach(() => {
    providerResponses = new Map();
    mockProvider = {
      loadResource: vi.fn(async (path: string) => {
        const handler = providerResponses.get(path);
        if (!handler) throw new Error(`Resource not found: ${path}`);
        return handler();
      }),
    };

    registry = new ResourceRegistry();
    registry.setProvider(mockProvider);
  });

  afterEach(() => {
    registry.clear();
  });

  function registerMaterial(id: string, path: string): TscnExternalResource {
    const resource: TscnExternalResource = { id, path, type: 'StandardMaterial3D' };
    registry.register(resource);
    return resource;
  }

  function registerTexture(id: string, path: string): TscnExternalResource {
    const resource: TscnExternalResource = { id, path, type: 'Texture2D' };
    registry.register(resource);
    return resource;
  }

  describe('ExtResource material loading', () => {
    it('loads material when provider has the resource', async () => {
      registerMaterial('mat1', 'res://materials/red.tres');
      providerResponses.set('res://materials/red.tres', () => Promise.resolve(validTresContent));

      const material = await registry.loadMaterial('mat1');

      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    });

    it('returns null when provider fails', async () => {
      registerMaterial('mat1', 'res://materials/red.tres');
      // No response registered → provider throws

      const material = await registry.loadMaterial('mat1');

      expect(material).toBeNull();
    });

    it('deduplicates concurrent requests', async () => {
      registerMaterial('mat1', 'res://materials/red.tres');
      providerResponses.set('res://materials/red.tres', () => Promise.resolve(validTresContent));

      const [mat1, mat2] = await Promise.all([
        registry.loadMaterial('mat1'),
        registry.loadMaterial('mat1'),
      ]);

      expect(mat1).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(mat2).toBeInstanceOf(THREE.MeshStandardMaterial);
      // Provider called only once due to deduplication
      expect(mockProvider.loadResource).toHaveBeenCalledTimes(1);
    });
  });

  describe('recovery cascade: resource:provided → texture → material → mesh', () => {
    it('retries failed texture when resource:provided fires', async () => {
      registerTexture('tex1', 'res://textures/albedo.png');

      // First load fails
      const texture1 = await registry.loadTexture('tex1');
      expect(texture1).toBeNull();

      // Now make the resource available
      providerResponses.set('res://textures/albedo.png', () => Promise.resolve(new ArrayBuffer(8)));

      // Emit resource:provided and wait for texture:loaded
      const eventBus = registry.getEventBus();
      const loadedPromise = eventBus.once<THREE.Texture>('texture', 'loaded', 'tex1', 5000);
      eventBus.emit<string>('resource', 'provided', 'res://textures/albedo.png', 'res://textures/albedo.png');

      const texture = await loadedPromise;
      expect(texture).toBeInstanceOf(THREE.Texture);
    });

    it('retries failed material when resource:provided fires', async () => {
      registerMaterial('mat1', 'res://materials/red.tres');

      // First load fails
      const mat1 = await registry.loadMaterial('mat1');
      expect(mat1).toBeNull();

      // Now make the resource available
      providerResponses.set('res://materials/red.tres', () => Promise.resolve(validTresContent));

      // Emit resource:provided and wait for material:loaded
      const eventBus = registry.getEventBus();
      const loadedPromise = eventBus.once<THREE.Material>('material', 'loaded', 'mat1', 5000);
      eventBus.emit<string>('resource', 'provided', 'res://materials/red.tres', 'res://materials/red.tres');

      const material = await loadedPromise;
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    });

    it('mesh event subscription receives material:loaded after recovery', async () => {
      registerMaterial('mat1', 'res://materials/red.tres');

      // First load fails
      await registry.loadMaterial('mat1');

      // Set up mesh-like event subscription
      const eventBus = registry.getEventBus();
      const meshMaterialUpdated = vi.fn();
      eventBus.on<THREE.Material>('material', 'loaded', (id, material) => {
        if (id === 'mat1' && material) {
          meshMaterialUpdated(material);
        }
      });

      // Now provide the resource
      providerResponses.set('res://materials/red.tres', () => Promise.resolve(validTresContent));
      const loadedPromise = eventBus.once<THREE.Material>('material', 'loaded', 'mat1', 5000);
      eventBus.emit<string>('resource', 'provided', 'res://materials/red.tres', 'res://materials/red.tres');

      await loadedPromise;
      expect(meshMaterialUpdated).toHaveBeenCalledTimes(1);
      expect(meshMaterialUpdated.mock.calls[0][0]).toBeInstanceOf(THREE.MeshStandardMaterial);
    });
  });

  describe('full cascade: texture → material → mesh subscription', () => {
    const tresWithTexture = `[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(0.8, 0.2, 0.2, 1)
albedo_texture = ExtResource("tex_albedo")
`;

    it('material with texture: both load successfully end-to-end', async () => {
      registerTexture('tex_albedo', 'res://textures/albedo.png');
      registerMaterial('mat1', 'res://materials/textured.tres');
      providerResponses.set('res://textures/albedo.png', () => Promise.resolve(new ArrayBuffer(8)));
      providerResponses.set('res://materials/textured.tres', () => Promise.resolve(tresWithTexture));

      const material = await registry.loadMaterial('mat1');

      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const stdMat = material as THREE.MeshStandardMaterial;
      expect(stdMat.map).toBeInstanceOf(THREE.Texture);
    });

    it('full three-step cascade: resource:provided → texture:loaded → material retries → mesh subscription fires', async () => {
      registerTexture('tex_albedo', 'res://textures/albedo.png');
      registerMaterial('mat1', 'res://materials/textured.tres');

      // Material references texture — both fail initially
      const mat = await registry.loadMaterial('mat1');
      expect(mat).toBeNull();

      // Set up mesh-like subscription for material:loaded
      const eventBus = registry.getEventBus();
      const meshUpdated = vi.fn();
      eventBus.on<THREE.Material>('material', 'loaded', (id, material) => {
        if (id === 'mat1' && material) meshUpdated(material);
      });

      // Now make BOTH resources available
      providerResponses.set('res://textures/albedo.png', () => Promise.resolve(new ArrayBuffer(8)));
      providerResponses.set('res://materials/textured.tres', () => Promise.resolve(tresWithTexture));

      // Provide the material file — triggers material retry
      const matLoadedPromise = eventBus.once<THREE.Material>('material', 'loaded', 'mat1', 5000);
      eventBus.emit<string>('resource', 'provided', 'res://materials/textured.tres', 'res://materials/textured.tres');

      const recoveredMat = await matLoadedPromise;
      expect(recoveredMat).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(meshUpdated).toHaveBeenCalledTimes(1);
    });

    it('multiple meshes sharing same material both receive update', async () => {
      registerMaterial('mat1', 'res://materials/red.tres');

      // First load fails
      await registry.loadMaterial('mat1');

      // Two mesh-like subscriptions
      const eventBus = registry.getEventBus();
      const mesh1Updated = vi.fn();
      const mesh2Updated = vi.fn();

      eventBus.on<THREE.Material>('material', 'loaded', (id, material) => {
        if (id === 'mat1' && material) mesh1Updated(material);
      });
      eventBus.on<THREE.Material>('material', 'loaded', (id, material) => {
        if (id === 'mat1' && material) mesh2Updated(material);
      });

      // Provide the resource
      providerResponses.set('res://materials/red.tres', () => Promise.resolve(validTresContent));
      const loadedPromise = eventBus.once<THREE.Material>('material', 'loaded', 'mat1', 5000);
      eventBus.emit<string>('resource', 'provided', 'res://materials/red.tres', 'res://materials/red.tres');

      await loadedPromise;
      expect(mesh1Updated).toHaveBeenCalledTimes(1);
      expect(mesh2Updated).toHaveBeenCalledTimes(1);
    });

    it('cleaned-up subscription does not fire on recovery', async () => {
      registerMaterial('mat1', 'res://materials/red.tres');
      await registry.loadMaterial('mat1');

      const eventBus = registry.getEventBus();
      const oldMeshUpdated = vi.fn();
      const newMeshUpdated = vi.fn();

      // Old mesh subscribes then cleans up (simulating scene re-render)
      const oldHandler = (id: string, material?: THREE.Material) => {
        if (id === 'mat1' && material) oldMeshUpdated(material);
      };
      eventBus.on<THREE.Material>('material', 'loaded', oldHandler);
      eventBus.off<THREE.Material>('material', 'loaded', oldHandler);

      // New mesh subscribes
      eventBus.on<THREE.Material>('material', 'loaded', (id, material) => {
        if (id === 'mat1' && material) newMeshUpdated(material);
      });

      // Provide resource
      providerResponses.set('res://materials/red.tres', () => Promise.resolve(validTresContent));
      const loadedPromise = eventBus.once<THREE.Material>('material', 'loaded', 'mat1', 5000);
      eventBus.emit<string>('resource', 'provided', 'res://materials/red.tres', 'res://materials/red.tres');

      await loadedPromise;
      expect(oldMeshUpdated).not.toHaveBeenCalled();
      expect(newMeshUpdated).toHaveBeenCalledTimes(1);
    });
  });

  describe('SubResource material events', () => {
    it('emits material:loaded event for SubResource materials via resolveResource', async () => {
      // This tests that resourceResolver.ts emits events for SubResource materials
      const eventBus = registry.getEventBus();
      const handler = vi.fn();
      eventBus.on<THREE.Material>('material', 'loaded', handler);

      // Import and call resolveResource with a SubResource material
      const { resolveResource } = await import('../resourceResolver');
      const { parseStandardMaterial3D } = await import('../materials/standardmaterial3d/parser');
      const { createStandardMaterial } = await import('../materials/standardmaterial3d/renderer');

      const scene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: 'Mat1',
            type: 'StandardMaterial3D',
            data: { id: 'Mat1', albedo_color: 'Color(1, 0, 0, 1)' },
          },
        ],
        resourceRegistry: registry,
      };

      const typeHandlers = {
        StandardMaterial3D: {
          parser: parseStandardMaterial3D,
          renderer: createStandardMaterial,
        },
      };

      const result = await resolveResource(
        'SubResource("Mat1")',
        scene as any,
        typeHandlers,
        'material'
      );

      expect(result).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(handler).toHaveBeenCalledWith('Mat1', result);
    });
  });
});
