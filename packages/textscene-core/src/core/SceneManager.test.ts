import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SceneManager } from './SceneManager';
import { TscnParser } from '../parser/TscnParser';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import { NodeTracker } from './NodeTracker';
import type { TscnScene, TscnNode } from '../parser/types';
import type { NodeLifecycleManager } from './NodeLifecycleManager';

describe('SceneManager', () => {
  let sceneManager: SceneManager;
  let parser: TscnParser;
  let resourceRegistry: ResourceRegistry;
  let nodeTracker: NodeTracker;
  let mockNodeLifecycle: Partial<NodeLifecycleManager>;

  beforeEach(() => {
    parser = new TscnParser();
    resourceRegistry = new ResourceRegistry();
    nodeTracker = new NodeTracker();

    // Mock NodeLifecycleManager
    mockNodeLifecycle = {
      addNode: vi.fn().mockResolvedValue(undefined),
      removeNode: vi.fn(),
      updateNode: vi.fn().mockResolvedValue(undefined),
    };

    sceneManager = new SceneManager(parser, nodeTracker);
    sceneManager.setResourceRegistry(resourceRegistry);
    sceneManager.setNodeLifecycleManager(mockNodeLifecycle as NodeLifecycleManager);
  });

  describe('loadScene', () => {
    it('should load and cache a scene', async () => {
      const scenePath = 'res://scenes/enemy.tscn';
      const sceneContent = `[gd_scene format=3]

[node name="Enemy" type="Node3D"]
`;

      // Mock resource provider
      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(sceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      // Register the resource
      resourceRegistry.register({
        id: '1_enemy',
        path: scenePath,
        type: 'PackedScene',
      });

      const scene = await sceneManager.loadScene(scenePath);

      expect(scene).toBeDefined();
      expect(scene.nodes).toHaveLength(1);
      expect(scene.nodes[0]!.name).toBe('Enemy');
      expect(mockProvider.loadResource).toHaveBeenCalledWith(scenePath, 'PackedScene');
    });

    it('should use cached scene on second load', async () => {
      const scenePath = 'res://scenes/enemy.tscn';
      const sceneContent = `[gd_scene format=3]

[node name="Enemy" type="Node3D"]
`;

      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(sceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_enemy',
        path: scenePath,
        type: 'PackedScene',
      });

      // Load twice
      const scene1 = await sceneManager.loadScene(scenePath);
      const scene2 = await sceneManager.loadScene(scenePath);

      expect(scene1).toBe(scene2); // Same instance
      expect(mockProvider.loadResource).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should throw error if ResourceRegistry not set', async () => {
      const newManager = new SceneManager(parser, nodeTracker);

      await expect(newManager.loadScene('res://test.tscn')).rejects.toThrow(
        'ResourceRegistry not set'
      );
    });
  });

  describe('addScene', () => {
    it('should track scene instances', async () => {
      const scenePath = 'res://scenes/enemy.tscn';
      const instancePath = 'Enemy1';
      const sceneContent = `[gd_scene format=3]

[node name="EnemyRoot" type="Node3D"]
`;

      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(sceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_enemy',
        path: scenePath,
        type: 'PackedScene',
      });

      const mockParentNode = {} as any;
      const mockSceneData = {} as TscnScene;

      await sceneManager.addScene(instancePath, scenePath, mockParentNode, mockSceneData);

      const instances = sceneManager.getInstances(scenePath);
      expect(instances).toHaveLength(1);
      expect(instances[0]).toBe(instancePath);
    });

    it('should track multiple instances of same scene', async () => {
      const scenePath = 'res://scenes/enemy.tscn';
      const sceneContent = `[gd_scene format=3]

[node name="EnemyRoot" type="Node3D"]
`;

      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(sceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_enemy',
        path: scenePath,
        type: 'PackedScene',
      });

      const mockParentNode = {} as any;
      const mockSceneData = {} as TscnScene;

      await sceneManager.addScene('Enemy1', scenePath, mockParentNode, mockSceneData);
      await sceneManager.addScene('Enemy2', scenePath, mockParentNode, mockSceneData);
      await sceneManager.addScene('Enemy3', scenePath, mockParentNode, mockSceneData);

      const instances = sceneManager.getInstances(scenePath);
      expect(instances).toHaveLength(3);
      expect(instances).toContain('Enemy1');
      expect(instances).toContain('Enemy2');
      expect(instances).toContain('Enemy3');
    });

    it('should call addNode for each root node in external scene', async () => {
      const scenePath = 'res://scenes/enemy.tscn';
      const sceneContent = `[gd_scene format=3]

[node name="EnemyRoot" type="Node3D"]

[node name="Sprite" type="Sprite2D" parent="EnemyRoot"]
`;

      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(sceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_enemy',
        path: scenePath,
        type: 'PackedScene',
      });

      const mockParentNode = {} as any;
      const mockSceneData = {} as TscnScene;

      await sceneManager.addScene('Enemy1', scenePath, mockParentNode, mockSceneData);

      // Should call addNode for the root node
      expect(mockNodeLifecycle.addNode).toHaveBeenCalled();
    });
  });

  describe('removeScene', () => {
    it('should remove instance from tracking', async () => {
      const scenePath = 'res://scenes/enemy.tscn';
      const sceneContent = `[gd_scene format=3]

[node name="EnemyRoot" type="Node3D"]
`;

      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(sceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_enemy',
        path: scenePath,
        type: 'PackedScene',
      });

      const mockParentNode = {} as any;
      const mockSceneData = {} as TscnScene;

      await sceneManager.addScene('Enemy1', scenePath, mockParentNode, mockSceneData);
      expect(sceneManager.getInstances(scenePath)).toHaveLength(1);

      sceneManager.removeScene('Enemy1');

      expect(sceneManager.getInstances(scenePath)).toHaveLength(0);
      expect(mockNodeLifecycle.removeNode).toHaveBeenCalledWith('Enemy1');
    });

    it('should handle removing non-existent instance gracefully', () => {
      sceneManager.removeScene('NonExistent');
      // Should not throw
      expect(mockNodeLifecycle.removeNode).not.toHaveBeenCalled();
    });
  });

  describe('updateScene', () => {
    it('should clear cache and reload scene', async () => {
      const scenePath = 'res://scenes/enemy.tscn';
      const sceneContent = `[gd_scene format=3]

[node name="EnemyRoot" type="Node3D"]
`;

      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(sceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_enemy',
        path: scenePath,
        type: 'PackedScene',
      });

      const mockParentNode = {} as any;
      const mockSceneData = {} as TscnScene;

      // Add instance
      await sceneManager.addScene('Enemy1', scenePath, mockParentNode, mockSceneData);

      // Mock node tracker to return node data
      const mockNode = { name: 'Enemy1', type: 'Node3D', children: [], properties: {}, instance: 'ExtResource("1_enemy")' } as TscnNode;
      const mockObject = { parent: null, userData: {} } as any;
      vi.spyOn(nodeTracker, 'getNode').mockReturnValue(mockNode);
      vi.spyOn(nodeTracker, 'getObject').mockReturnValue(mockObject);
      vi.spyOn(nodeTracker, 'getAllPaths').mockReturnValue(['Enemy1', 'Enemy1/EnemyRoot']);

      // Update scene
      await sceneManager.updateScene(scenePath);

      // Should have called loadResource twice (initial load + reload)
      expect(mockProvider.loadResource).toHaveBeenCalledTimes(2);
    });

    it('should do nothing if no instances exist', async () => {
      const scenePath = 'res://scenes/enemy.tscn';

      await sceneManager.updateScene(scenePath);

      // Should not call any node lifecycle methods
      expect(mockNodeLifecycle.removeNode).not.toHaveBeenCalled();
      expect(mockNodeLifecycle.addNode).not.toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    it('hasInstances should return false for unknown scene', () => {
      expect(sceneManager.hasInstances('res://unknown.tscn')).toBe(false);
    });

    it('hasInstances should return true after adding instance', async () => {
      const scenePath = 'res://scenes/enemy.tscn';
      const sceneContent = `[gd_scene format=3]

[node name="EnemyRoot" type="Node3D"]
`;

      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(sceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_enemy',
        path: scenePath,
        type: 'PackedScene',
      });

      const mockParentNode = {} as any;
      const mockSceneData = {} as TscnScene;

      await sceneManager.addScene('Enemy1', scenePath, mockParentNode, mockSceneData);

      expect(sceneManager.hasInstances(scenePath)).toBe(true);
    });

    it('getTotalInstanceCount should return correct count', async () => {
      const scene1Path = 'res://scenes/enemy.tscn';
      const scene2Path = 'res://scenes/player.tscn';
      const sceneContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(sceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({ id: '1', path: scene1Path, type: 'PackedScene' });
      resourceRegistry.register({ id: '2', path: scene2Path, type: 'PackedScene' });

      const mockParentNode = {} as any;
      const mockSceneData = {} as TscnScene;

      await sceneManager.addScene('Enemy1', scene1Path, mockParentNode, mockSceneData);
      await sceneManager.addScene('Enemy2', scene1Path, mockParentNode, mockSceneData);
      await sceneManager.addScene('Player1', scene2Path, mockParentNode, mockSceneData);

      expect(sceneManager.getTotalInstanceCount()).toBe(3);
    });

    it('getTrackedScenes should return all scene paths', async () => {
      const scene1Path = 'res://scenes/enemy.tscn';
      const scene2Path = 'res://scenes/player.tscn';
      const sceneContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(sceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({ id: '1', path: scene1Path, type: 'PackedScene' });
      resourceRegistry.register({ id: '2', path: scene2Path, type: 'PackedScene' });

      const mockParentNode = {} as any;
      const mockSceneData = {} as TscnScene;

      await sceneManager.addScene('Enemy1', scene1Path, mockParentNode, mockSceneData);
      await sceneManager.addScene('Player1', scene2Path, mockParentNode, mockSceneData);

      const tracked = sceneManager.getTrackedScenes();
      expect(tracked).toHaveLength(2);
      expect(tracked).toContain(scene1Path);
      expect(tracked).toContain(scene2Path);
    });

    it('clear should reset all state', async () => {
      const scenePath = 'res://scenes/enemy.tscn';
      const sceneContent = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(sceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({ id: '1', path: scenePath, type: 'PackedScene' });

      const mockParentNode = {} as any;
      const mockSceneData = {} as TscnScene;

      await sceneManager.addScene('Enemy1', scenePath, mockParentNode, mockSceneData);

      sceneManager.clear();

      expect(sceneManager.getTotalInstanceCount()).toBe(0);
      expect(sceneManager.getTrackedScenes()).toHaveLength(0);
    });
  });
});
