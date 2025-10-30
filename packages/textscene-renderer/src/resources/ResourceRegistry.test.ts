import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceRegistry } from './ResourceRegistry';
import type { ResourceProvider } from './ResourceProvider';
import type { TscnExternalResource } from '../parser/types';

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
});
