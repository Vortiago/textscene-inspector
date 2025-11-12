import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { ResourceRegistry } from './ResourceRegistry';
import type { ResourceProvider } from './ResourceProvider';
import type { TscnExternalResource } from '../parser/types';
import * as logger from '../logger';

// Mock THREE.TextureLoader
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');

  class MockTextureLoader {
    load(url: string, onLoad?: (texture: THREE.Texture) => void, _onProgress?: (event: ProgressEvent) => void, _onError?: (err: unknown) => void) {
      const mockTexture = new actual.Texture();
      mockTexture.image = { width: 512, height: 512 };
      if (onLoad) {
        setTimeout(() => onLoad(mockTexture), 0);
      }
    }
  }

  return {
    ...actual,
    TextureLoader: MockTextureLoader,
  };
});

// Mock GLTFLoader
vi.mock('three/addons/loaders/GLTFLoader.js', async () => {
  const THREE = await vi.importActual<typeof import('three')>('three');

  class MockGLTFLoader {
    async parseAsync(_data: ArrayBuffer, _path: string) {
      // Return mock GLTF with scene containing a simple object
      const mockScene = new THREE.Group();
      mockScene.name = 'MockGLTFScene';

      const mockMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial()
      );
      mockMesh.name = 'MockGLTFMesh';
      mockScene.add(mockMesh);

      return {
        scene: mockScene,
        scenes: [mockScene],
        animations: [],
        cameras: [],
        asset: {},
        parser: {} as any,
        userData: {},
      };
    }
  }

  return {
    GLTFLoader: MockGLTFLoader,
  };
});

describe('ResourceRegistry', () => {
  let registry: ResourceRegistry;

  beforeEach(() => {
    registry = new ResourceRegistry();
  });

  describe('register', () => {
    it('should register resource by path', () => {
      const resource: TscnExternalResource = {
        id: '1',
        path: 'res://scenes/player.tscn',
        type: 'PackedScene',
      };

      registry.register(resource);

      expect(registry.getMetadata('res://scenes/player.tscn')).toEqual(resource);
    });

    it('should register multiple resources', () => {
      const resource1: TscnExternalResource = {
        id: '1',
        path: 'res://scenes/player.tscn',
        type: 'PackedScene',
      };
      const resource2: TscnExternalResource = {
        id: '2',
        path: 'res://textures/icon.png',
        type: 'Texture2D',
      };

      registry.register(resource1);
      registry.register(resource2);

      expect(registry.getAllResources()).toHaveLength(2);
      expect(registry.getMetadata('res://scenes/player.tscn')).toEqual(resource1);
      expect(registry.getMetadata('res://textures/icon.png')).toEqual(resource2);
    });
  });

  describe('hasResource', () => {
    it('should return true for registered resources', () => {
      const resource: TscnExternalResource = {
        id: '1',
        path: 'res://scenes/player.tscn',
        type: 'PackedScene',
      };

      registry.register(resource);

      expect(registry.hasResource('res://scenes/player.tscn')).toBe(true);
    });

    it('should return false for unregistered resources', () => {
      expect(registry.hasResource('res://not/found.tscn')).toBe(false);
    });
  });

  describe('parseReference', () => {
    it('should parse ExtResource reference with ID', () => {
      const result = ResourceRegistry.parseReference('ExtResource("1_abc")');
      expect(result).toBe('1_abc');
    });

    it('should parse ExtResource reference with UID', () => {
      const result = ResourceRegistry.parseReference('ExtResource("uid://d5713qx52vb1")');
      expect(result).toBe('uid://d5713qx52vb1');
    });

    it('should return null for non-ExtResource strings', () => {
      expect(ResourceRegistry.parseReference('SubResource("BoxMesh_1")')).toBeNull();
      expect(ResourceRegistry.parseReference('not a reference')).toBeNull();
      expect(ResourceRegistry.parseReference('')).toBeNull();
    });

    it('should handle ExtResource with single quotes', () => {
      // Godot uses double quotes, but test robustness
      const result = ResourceRegistry.parseReference("ExtResource('1_abc')");
      expect(result).toBeNull(); // Should only match double quotes
    });
  });

  describe('resolveInstancePath', () => {
    it('should resolve valid instance reference to scene path', () => {
      const resource: TscnExternalResource = {
        id: '1_scene',
        path: 'res://scenes/enemy.tscn',
        type: 'PackedScene',
      };
      registry.register(resource);

      const result = registry.resolveInstancePath('ExtResource("1_scene")');
      expect(result).toBe('res://scenes/enemy.tscn');
    });

    it('should return null for undefined instance', () => {
      expect(registry.resolveInstancePath(undefined)).toBeNull();
    });

    it('should return null for invalid reference format', () => {
      const result = registry.resolveInstancePath('not a reference');
      expect(result).toBeNull();
    });

    it('should return null for missing resource', () => {
      const result = registry.resolveInstancePath('ExtResource("missing_id")');
      expect(result).toBeNull();
    });

    it('should return null for non-PackedScene resource', () => {
      const resource: TscnExternalResource = {
        id: '1_texture',
        path: 'res://textures/icon.png',
        type: 'Texture2D',
      };
      registry.register(resource);

      const result = registry.resolveInstancePath('ExtResource("1_texture")');
      expect(result).toBeNull();
    });

    it('should log warning for invalid reference format', () => {
      const warnSpy = vi.spyOn(logger, 'warn');
      registry.resolveInstancePath('invalid');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid instance reference format')
      );
    });

    it('should log warning for missing resource', () => {
      const warnSpy = vi.spyOn(logger, 'warn');
      registry.resolveInstancePath('ExtResource("missing")');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Instance resource not found')
      );
    });

    it('should log warning for wrong resource type', () => {
      const warnSpy = vi.spyOn(logger, 'warn');
      const resource: TscnExternalResource = {
        id: '1_mat',
        path: 'res://materials/test.tres',
        type: 'StandardMaterial3D',
      };
      registry.register(resource);

      registry.resolveInstancePath('ExtResource("1_mat")');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not a PackedScene')
      );
    });
  });

  describe('loadByPath', () => {
    it('should throw error if no provider is set', async () => {
      const resource: TscnExternalResource = {
        id: '1',
        path: 'res://scenes/player.tscn',
        type: 'PackedScene',
      };
      registry.register(resource);

      await expect(registry.loadByPath('res://scenes/player.tscn')).rejects.toThrow(
        'No ResourceProvider set'
      );
    });

    it('should load resource using provider', async () => {
      const resource: TscnExternalResource = {
        id: '1',
        path: 'res://scenes/player.tscn',
        type: 'PackedScene',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async (path: string, _type: string) => {
          return `content of ${path}`;
        },
      };
      registry.setProvider(mockProvider);

      const result = await registry.loadByPath('res://scenes/player.tscn');
      expect(result).toBe('content of res://scenes/player.tscn');
    });

    it('should cache loaded resources', async () => {
      const resource: TscnExternalResource = {
        id: '1',
        path: 'res://scenes/player.tscn',
        type: 'PackedScene',
      };
      registry.register(resource);

      let loadCount = 0;
      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          loadCount++;
          return 'content';
        },
      };
      registry.setProvider(mockProvider);

      await registry.loadByPath('res://scenes/player.tscn');
      await registry.loadByPath('res://scenes/player.tscn');
      await registry.loadByPath('res://scenes/player.tscn');

      expect(loadCount).toBe(1); // Should only load once
    });

    it('should throw error for unregistered resource', async () => {
      const mockProvider: ResourceProvider = {
        loadResource: async () => 'content',
      };
      registry.setProvider(mockProvider);

      await expect(registry.loadByPath('res://not/found.tscn')).rejects.toThrow(
        'Resource not found in registry'
      );
    });

    it('should detect circular dependencies', async () => {
      const resource1: TscnExternalResource = {
        id: '1',
        path: 'res://scenes/a.tscn',
        type: 'PackedScene',
      };
      const resource2: TscnExternalResource = {
        id: '2',
        path: 'res://scenes/b.tscn',
        type: 'PackedScene',
      };

      registry.register(resource1);
      registry.register(resource2);

      const mockProvider: ResourceProvider = {
        loadResource: async (path: string) => {
          // Simulate circular dependency: a.tscn loads b.tscn which loads a.tscn
          if (path === 'res://scenes/a.tscn') {
            await registry.loadByPath('res://scenes/b.tscn');
          } else if (path === 'res://scenes/b.tscn') {
            await registry.loadByPath('res://scenes/a.tscn');
          }
          return 'content';
        },
      };
      registry.setProvider(mockProvider);

      await expect(registry.loadByPath('res://scenes/a.tscn')).rejects.toThrow(
        'Circular dependency detected'
      );
    });
  });

  describe('clear', () => {
    it('should clear all resources and cache', async () => {
      const resource: TscnExternalResource = {
        id: '1',
        path: 'res://scenes/player.tscn',
        type: 'PackedScene',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => 'content',
      };
      registry.setProvider(mockProvider);

      await registry.loadByPath('res://scenes/player.tscn');

      registry.clear();

      expect(registry.getAllResources()).toHaveLength(0);
      expect(registry.hasResource('res://scenes/player.tscn')).toBe(false);
    });
  });

  describe('loadTexture', () => {

    it('should load Texture2D as THREE.Texture', async () => {
      const resource: TscnExternalResource = {
        id: '1_tex',
        path: 'res://textures/test.png',
        type: 'Texture2D',
      };
      registry.register(resource);

      // Mock provider that returns binary data
      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          // Return a fake PNG ArrayBuffer
          return new ArrayBuffer(100);
        },
      };
      registry.setProvider(mockProvider);

      const texture = await registry.loadTexture('1_tex');

      expect(texture).toBeInstanceOf(THREE.Texture);
      expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
    });

    it('should cache loaded textures', async () => {
      const resource: TscnExternalResource = {
        id: '1_tex',
        path: 'res://textures/test.png',
        type: 'Texture2D',
      };
      registry.register(resource);

      let loadCount = 0;
      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          loadCount++;
          return new ArrayBuffer(100);
        },
      };
      registry.setProvider(mockProvider);

      const texture1 = await registry.loadTexture('1_tex');
      const texture2 = await registry.loadTexture('1_tex');

      expect(texture1).toBe(texture2); // Same instance
      expect(loadCount).toBe(1); // Only loaded once via loadByPath
    });

    it('should throw error for non-texture resource', async () => {
      const resource: TscnExternalResource = {
        id: '1_scene',
        path: 'res://scenes/test.tscn',
        type: 'PackedScene',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => 'content',
      };
      registry.setProvider(mockProvider);

      const result = await registry.loadTexture('1_scene');
      expect(result).toBeNull();
    });

    it('should return null if texture data is not binary', async () => {
      const resource: TscnExternalResource = {
        id: '1_tex',
        path: 'res://textures/test.png',
        type: 'Texture2D',
      };
      registry.register(resource);

      // Provider incorrectly returns string instead of ArrayBuffer
      const mockProvider: ResourceProvider = {
        loadResource: async () => 'not binary data',
      };
      registry.setProvider(mockProvider);

      const result = await registry.loadTexture('1_tex');
      expect(result).toBeNull();
    });

    it('should determine correct MIME type from extension', async () => {
      const testCases = [
        { path: 'res://test.png', type: 'Texture2D' },
        { path: 'res://test.jpg', type: 'Texture2D' },
        { path: 'res://test.jpeg', type: 'Texture2D' },
        { path: 'res://test.svg', type: 'Texture2D' },
        { path: 'res://test.webp', type: 'Texture2D' },
      ];

      const mockProvider: ResourceProvider = {
        loadResource: async () => new ArrayBuffer(100),
      };
      registry.setProvider(mockProvider);

      for (const testCase of testCases) {
        const resource: TscnExternalResource = {
          id: `tex_${testCase.path}`,
          path: testCase.path,
          type: testCase.type,
        };
        registry.register(resource);

        // Should not throw - this validates MIME type handling
        await expect(registry.loadTexture(testCase.path)).resolves.toBeInstanceOf(
          THREE.Texture
        );
      }
    });

    it('should return null for texture loading errors', async () => {
      const resource: TscnExternalResource = {
        id: '1_tex',
        path: 'res://textures/test.png',
        type: 'Texture2D',
      };
      registry.register(resource);

      // Mock a failing TextureLoader for this test
      class FailingTextureLoader {
        load(_url: string, _onLoad?: unknown, _onProgress?: unknown, onError?: (err: unknown) => void) {
          if (onError) {
            setTimeout(() => onError(new Error('Network error')), 0);
          }
        }
      }

      // Temporarily replace the TextureLoader
      const originalLoader = THREE.TextureLoader;
      (THREE as any).TextureLoader = FailingTextureLoader;

      const mockProvider: ResourceProvider = {
        loadResource: async () => new ArrayBuffer(100),
      };
      registry.setProvider(mockProvider);

      try {
        const result = await registry.loadTexture('1_tex');
        expect(result).toBeNull();
      } finally {
        // Restore original
        (THREE as any).TextureLoader = originalLoader;
      }
    });
  });

  describe('loadMaterial', () => {
    it('should load StandardMaterial3D from .tres file', async () => {
      const resource: TscnExternalResource = {
        id: '1_mat',
        path: 'res://materials/test.tres',
        type: 'StandardMaterial3D',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(1, 0, 0, 1)
metallic = 0.8
roughness = 0.3
        `,
      };
      registry.setProvider(mockProvider);

      const material = await registry.loadMaterial('1_mat');

      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect((material as THREE.MeshStandardMaterial).color.r).toBeCloseTo(1.0);
      expect((material as THREE.MeshStandardMaterial).metalness).toBe(0.8);
      expect((material as THREE.MeshStandardMaterial).roughness).toBe(0.3);
    });

    it('should cache loaded materials', async () => {
      const resource: TscnExternalResource = {
        id: '1_mat',
        path: 'res://materials/test.tres',
        type: 'StandardMaterial3D',
      };
      registry.register(resource);

      let loadCount = 0;
      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          loadCount++;
          return `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(0.5, 0.5, 0.5, 1)
          `;
        },
      };
      registry.setProvider(mockProvider);

      const mat1 = await registry.loadMaterial('1_mat');
      const mat2 = await registry.loadMaterial('1_mat');

      expect(mat1).toBe(mat2); // Same instance
      expect(loadCount).toBe(1); // Only loaded once via loadByPath
    });

    it('should return null for non-material resource', async () => {
      const resource: TscnExternalResource = {
        id: '1_tex',
        path: 'res://textures/test.png',
        type: 'Texture2D',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => new ArrayBuffer(100),
      };
      registry.setProvider(mockProvider);

      const result = await registry.loadMaterial('1_tex');
      expect(result).toBeNull();
    });

    it('should return null if material data is not text', async () => {
      const resource: TscnExternalResource = {
        id: '1_mat',
        path: 'res://materials/test.tres',
        type: 'StandardMaterial3D',
      };
      registry.register(resource);

      // Provider incorrectly returns ArrayBuffer instead of string
      const mockProvider: ResourceProvider = {
        loadResource: async () => new ArrayBuffer(100),
      };
      registry.setProvider(mockProvider);

      const result = await registry.loadMaterial('1_mat');
      expect(result).toBeNull();
    });

    it('should handle invalid .tres file format', async () => {
      const resource: TscnExternalResource = {
        id: '1_mat',
        path: 'res://materials/test.tres',
        type: 'StandardMaterial3D',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => 'invalid content',
      };
      registry.setProvider(mockProvider);

      const result = await registry.loadMaterial('1_mat');
      expect(result).toBeNull();
    });

    it('should handle material with emission properties', async () => {
      const resource: TscnExternalResource = {
        id: '1_mat',
        path: 'res://materials/emissive.tres',
        type: 'StandardMaterial3D',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(0.2, 0.2, 0.2, 1)
emission_enabled = true
emission = Color(1, 0.5, 0, 1)
emission_energy_multiplier = 2.0
        `,
      };
      registry.setProvider(mockProvider);

      const material = await registry.loadMaterial('1_mat');

      // Material should load successfully even with unsupported emission properties
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const stdMat = material as THREE.MeshStandardMaterial;
      expect(stdMat.color.r).toBeCloseTo(0.2);
    });

    it('should call onResourceNeeded callback on material load failure', async () => {
      const resource: TscnExternalResource = {
        id: '1_mat',
        path: 'res://materials/missing.tres',
        type: 'StandardMaterial3D',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          throw new Error('File not found');
        },
      };
      registry.setProvider(mockProvider);

      const callbackSpy = vi.fn();
      registry.setOnResourceNeeded(callbackSpy);

      const result = await registry.loadMaterial('1_mat');

      expect(result).toBeNull();
      expect(callbackSpy).toHaveBeenCalledWith({
        path: 'res://materials/missing.tres',
        type: 'StandardMaterial3D',
        referencedBy: expect.stringContaining('1_mat'),
        error: expect.any(String)
      });
    });

    it('should handle material loading with multiple properties', async () => {
      const resource: TscnExternalResource = {
        id: '1_mat',
        path: 'res://materials/complex.tres',
        type: 'StandardMaterial3D',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => `
[gd_resource type="StandardMaterial3D" format=3]

[resource]
albedo_color = Color(0.7, 0.7, 0.75, 1)
metallic = 0.9
roughness = 0.2
emission_enabled = true
emission = Color(1, 0.5, 0, 1)
transparency = 0.5
        `,
      };
      registry.setProvider(mockProvider);

      const material = await registry.loadMaterial('1_mat');

      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const stdMat = material as THREE.MeshStandardMaterial;
      expect(stdMat.color.r).toBeCloseTo(0.7);
      expect(stdMat.metalness).toBe(0.9);
      expect(stdMat.roughness).toBe(0.2);
    });
  });

  describe('Regression: Stack Overflow with Missing Textures', () => {
    it('should handle many concurrent missing texture loads without stack overflow', async () => {
      // Simulate LD-58 scenario: many textures referenced but files missing
      const textureCount = 50;
      const textures: TscnExternalResource[] = [];

      for (let i = 0; i < textureCount; i++) {
        textures.push({
          id: `${i}_tex`,
          path: `res://textures/missing_${i}.png`,
          type: 'Texture2D',
        });
      }

      textures.forEach(tex => registry.register(tex));

      // Mock provider that throws errors for all missing files
      let loadAttempts = 0;
      const mockProvider: ResourceProvider = {
        loadResource: async (path: string) => {
          loadAttempts++;
          throw new Error(`File not found: ${path}`);
        },
      };
      registry.setProvider(mockProvider);

      const callbackSpy = vi.fn();
      registry.setOnResourceNeeded(callbackSpy);

      // Load all textures concurrently (simulates material parser loading dependencies)
      const loadPromises = textures.map(tex => registry.loadTexture(tex.id));
      const results = await Promise.all(loadPromises);

      // All should return null
      expect(results.every(r => r === null)).toBe(true);

      // Each texture should only be attempted once (deduplication working)
      expect(loadAttempts).toBe(textureCount);

      // Callback should be called for each failed texture
      expect(callbackSpy).toHaveBeenCalledTimes(textureCount);

      // Verify null results are cached - subsequent loads should hit cache
      const secondLoadAttempts = loadAttempts;
      const cachedResults = await Promise.all(
        textures.map(tex => registry.loadTexture(tex.id))
      );

      expect(cachedResults.every(r => r === null)).toBe(true);
      expect(loadAttempts).toBe(secondLoadAttempts); // No new load attempts
      expect(callbackSpy).toHaveBeenCalledTimes(textureCount); // No new callbacks
    });

    it('should handle concurrent duplicate requests for same missing texture', async () => {
      const resource: TscnExternalResource = {
        id: '1_tex',
        path: 'res://textures/missing.png',
        type: 'Texture2D',
      };
      registry.register(resource);

      let loadAttempts = 0;
      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          loadAttempts++;
          // Simulate async file system operation
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('File not found');
        },
      };
      registry.setProvider(mockProvider);

      // Fire off 20 concurrent requests for the same texture
      const requests = Array.from({ length: 20 }, () =>
        registry.loadTexture('1_tex')
      );

      const results = await Promise.all(requests);

      // All should return null
      expect(results.every(r => r === null)).toBe(true);

      // Should only attempt to load once (deduplication)
      expect(loadAttempts).toBe(1);
    });

    it('should cache null for missing textures and not retry on subsequent access', async () => {
      const resource: TscnExternalResource = {
        id: '1_tex',
        path: 'res://textures/missing.png',
        type: 'Texture2D',
      };
      registry.register(resource);

      let loadAttempts = 0;
      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          loadAttempts++;
          throw new Error('File not found');
        },
      };
      registry.setProvider(mockProvider);

      // First load
      const result1 = await registry.loadTexture('1_tex');
      expect(result1).toBeNull();
      expect(loadAttempts).toBe(1);

      // Second load - should hit cache
      const result2 = await registry.loadTexture('1_tex');
      expect(result2).toBeNull();
      expect(loadAttempts).toBe(1); // Still 1, not 2

      // Third load - should still hit cache
      const result3 = await registry.loadTexture('1_tex');
      expect(result3).toBeNull();
      expect(loadAttempts).toBe(1); // Still 1, not 3
    });

    it('should handle provider errors gracefully without propagating exceptions', async () => {
      const resource: TscnExternalResource = {
        id: '1_tex',
        path: 'res://textures/error.png',
        type: 'Texture2D',
      };
      registry.register(resource);

      // Provider that throws various types of errors
      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          throw new Error('Maximum call stack size exceeded');
        },
      };
      registry.setProvider(mockProvider);

      // Should NOT throw - must return null
      const result = await registry.loadTexture('1_tex');
      expect(result).toBeNull();

      // Should be cached as null
      const cachedResult = await registry.loadTexture('1_tex');
      expect(cachedResult).toBeNull();
    });

    it('should handle missing materials without stack overflow', async () => {
      const materialCount = 20;
      const materials: TscnExternalResource[] = [];

      for (let i = 0; i < materialCount; i++) {
        materials.push({
          id: `${i}_mat`,
          path: `res://materials/missing_${i}.tres`,
          type: 'StandardMaterial3D',
        });
      }

      materials.forEach(mat => registry.register(mat));

      let loadAttempts = 0;
      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          loadAttempts++;
          throw new Error('File not found');
        },
      };
      registry.setProvider(mockProvider);

      // Load all materials concurrently
      const loadPromises = materials.map(mat => registry.loadMaterial(mat.id));
      const results = await Promise.all(loadPromises);

      // All should return null
      expect(results.every(r => r === null)).toBe(true);

      // Each material should only be attempted once
      expect(loadAttempts).toBe(materialCount);

      // Verify null results are cached
      const cachedResults = await Promise.all(
        materials.map(mat => registry.loadMaterial(mat.id))
      );

      expect(cachedResults.every(r => r === null)).toBe(true);
      expect(loadAttempts).toBe(materialCount); // No new attempts
    });
  });

  describe('loadGLBMesh', () => {
    it('should load GLB mesh from .glb file', async () => {
      const resource: TscnExternalResource = {
        id: '1_glb',
        path: 'res://models/door.glb',
        type: 'PackedScene',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => new ArrayBuffer(100), // Mock GLB data
      };
      registry.setProvider(mockProvider);

      const mesh = await registry.loadGLBMesh('1_glb');

      expect(mesh).toBeInstanceOf(THREE.Group);
      expect(mesh?.name).toBe('MockGLTFScene');
      expect(mesh?.children.length).toBeGreaterThan(0);
    });

    it('should load GLTF mesh from .gltf file', async () => {
      const resource: TscnExternalResource = {
        id: '1_gltf',
        path: 'res://models/frame.gltf',
        type: 'PackedScene',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => new ArrayBuffer(100), // Mock GLTF data
      };
      registry.setProvider(mockProvider);

      const mesh = await registry.loadGLBMesh('1_gltf');

      expect(mesh).toBeInstanceOf(THREE.Group);
      expect(mesh?.name).toBe('MockGLTFScene');
    });

    it('should cache loaded GLB meshes', async () => {
      const resource: TscnExternalResource = {
        id: '1_glb',
        path: 'res://models/door.glb',
        type: 'PackedScene',
      };
      registry.register(resource);

      let loadCount = 0;
      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          loadCount++;
          return new ArrayBuffer(100);
        },
      };
      registry.setProvider(mockProvider);

      const mesh1 = await registry.loadGLBMesh('1_glb');
      const mesh2 = await registry.loadGLBMesh('1_glb');

      expect(mesh1).toBe(mesh2); // Same instance
      expect(loadCount).toBe(1); // Only loaded once
    });

    it('should return null for non-GLB/GLTF file extensions', async () => {
      const resource: TscnExternalResource = {
        id: '1_tscn',
        path: 'res://scenes/player.tscn',
        type: 'PackedScene',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => new ArrayBuffer(100),
      };
      registry.setProvider(mockProvider);

      const result = await registry.loadGLBMesh('1_tscn');
      expect(result).toBeNull();
    });

    it('should return null if resource data is not ArrayBuffer', async () => {
      const resource: TscnExternalResource = {
        id: '1_glb',
        path: 'res://models/door.glb',
        type: 'PackedScene',
      };
      registry.register(resource);

      // Provider incorrectly returns string instead of ArrayBuffer
      const mockProvider: ResourceProvider = {
        loadResource: async () => 'invalid data',
      };
      registry.setProvider(mockProvider);

      const result = await registry.loadGLBMesh('1_glb');
      expect(result).toBeNull();
    });

    it('should handle GLB parsing errors gracefully', async () => {
      const resource: TscnExternalResource = {
        id: '1_glb',
        path: 'res://models/corrupt.glb',
        type: 'PackedScene',
      };
      registry.register(resource);

      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          throw new Error('Corrupt GLB file');
        },
      };
      registry.setProvider(mockProvider);

      const result = await registry.loadGLBMesh('1_glb');
      expect(result).toBeNull();
    });

    it('should handle concurrent GLB loads with deduplication', async () => {
      const resource: TscnExternalResource = {
        id: '1_glb',
        path: 'res://models/door.glb',
        type: 'PackedScene',
      };
      registry.register(resource);

      let loadCount = 0;
      const mockProvider: ResourceProvider = {
        loadResource: async () => {
          loadCount++;
          // Simulate async delay
          await new Promise(resolve => setTimeout(resolve, 10));
          return new ArrayBuffer(100);
        },
      };
      registry.setProvider(mockProvider);

      // Start multiple loads concurrently
      const [mesh1, mesh2, mesh3] = await Promise.all([
        registry.loadGLBMesh('1_glb'),
        registry.loadGLBMesh('1_glb'),
        registry.loadGLBMesh('1_glb'),
      ]);

      // All should return the same instance
      expect(mesh1).toBe(mesh2);
      expect(mesh2).toBe(mesh3);

      // Only loaded once despite concurrent requests
      expect(loadCount).toBe(1);
    });
  });
});
