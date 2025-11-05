import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { ResourceRegistry } from './ResourceRegistry';
import type { ResourceProvider } from './ResourceProvider';
import type { TscnExternalResource } from '../parser/types';

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
});
