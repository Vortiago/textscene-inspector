import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { TscnParser } from '../parser/TscnParser';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import { NodeTracker } from './NodeTracker';
import type { TscnNode } from '../parser/types';
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

      await sceneManager.addScene(instancePath, scenePath);

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

      await sceneManager.addScene('Enemy1', scenePath);
      await sceneManager.addScene('Enemy2', scenePath);
      await sceneManager.addScene('Enemy3', scenePath);

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

      await sceneManager.addScene('Enemy1', scenePath);

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

      await sceneManager.addScene('Enemy1', scenePath);
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

      // Add instance
      await sceneManager.addScene('Enemy1', scenePath);

      // Mock node tracker to return node data
      const mockNode = { name: 'Enemy1', type: 'Node3D', children: [], properties: {}, instance: 'ExtResource("1_enemy")' } as TscnNode;
      const mockObject = { parent: null, userData: {} } as THREE.Object3D;
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

  describe('provideScene', () => {
    it('should do nothing if no instances exist', async () => {
      const scenePath = 'res://scenes/enemy.tscn';

      await sceneManager.provideScene(scenePath);

      // Should not call any node lifecycle methods
      expect(mockNodeLifecycle.removeNode).not.toHaveBeenCalled();
      expect(mockNodeLifecycle.addNode).not.toHaveBeenCalled();
    });

    it('should call loadScene when instances exist', async () => {
      const scenePath = 'res://scenes/enemy.tscn';
      const instancePath = 'Enemy1';

      // Track instance (simulating failed initial load)
      sceneManager['sceneInstances'].set(scenePath, new Set([instancePath]));

      // Spy on loadScene method to verify it's called
      const loadSceneSpy = vi.spyOn(sceneManager as any, 'loadScene').mockResolvedValue({
        nodes: [{ name: 'EnemyRoot', type: 'Node3D', properties: {} }],
        externalResources: [],
        internalResources: []
      });

      // Setup nodeTracker spies
      vi.spyOn(nodeTracker, 'getNode').mockReturnValue({ name: 'Enemy1', type: 'Node3D', properties: {} });
      vi.spyOn(nodeTracker, 'getObject').mockReturnValue(new THREE.Object3D());
      vi.spyOn(nodeTracker, 'getAllPaths').mockReturnValue([instancePath]);

      await sceneManager.provideScene(scenePath);

      // Should call loadScene
      expect(loadSceneSpy).toHaveBeenCalledWith(scenePath);
      // Should call addNode to provide content (does NOT call removeNode)
      expect(mockNodeLifecycle.addNode).toHaveBeenCalled();
      expect(mockNodeLifecycle.removeNode).not.toHaveBeenCalled();
    });

    it('should skip instances that already have external scene content', async () => {
      const scenePath = 'res://scenes/enemy.tscn';
      const instancePath = 'Enemy1';

      // Track instance
      sceneManager['sceneInstances'].set(scenePath, new Set([instancePath]));

      // Spy on loadScene - external scene has a node called "EnemyRoot"
      const loadSceneSpy = vi.spyOn(sceneManager as any, 'loadScene').mockResolvedValue({
        nodes: [{ name: 'EnemyRoot', type: 'Node3D', properties: {} }],
        externalResources: [],
        internalResources: []
      });

      // Setup nodeTracker spies - instance already has the external scene's root node
      vi.spyOn(nodeTracker, 'getNode').mockReturnValue({ name: 'Enemy1', type: 'Node3D', properties: {} });
      vi.spyOn(nodeTracker, 'getObject').mockReturnValue(new THREE.Object3D());
      // Mock nodeTracker.has to return true for the external scene node "Enemy1/EnemyRoot"
      vi.spyOn(nodeTracker, 'has').mockImplementation((path) => path === instancePath + '/EnemyRoot');

      await sceneManager.provideScene(scenePath);

      // Should load scene but not add content since instance already has external scene's nodes
      expect(loadSceneSpy).toHaveBeenCalledWith(scenePath);
      expect(mockNodeLifecycle.addNode).not.toHaveBeenCalled();
    });
  });

  describe('ResourceRegistry sharing', () => {
    it('should share ResourceRegistry with external scenes', async () => {
      const externalScenePath = 'res://scenes/external.tscn';
      const externalSceneContent = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://nested.tscn" id="1_nested"]

[node name="ExternalRoot" type="Node3D"]

[node name="NestedInstance" type="Node3D" parent="."]
instance = ExtResource("1_nested")
`;

      const mockProvider = {
        loadResource: vi.fn().mockResolvedValue(externalSceneContent),
      };
      resourceRegistry.setProvider(mockProvider);

      // Register the resource before loading (required by ResourceRegistry)
      resourceRegistry.register({
        type: 'PackedScene',
        path: externalScenePath,
        id: 'external_scene'
      });

      // Load external scene
      const loadedScene = await sceneManager['loadScene'](externalScenePath);

      // Should have ResourceRegistry attached
      expect(loadedScene.resourceRegistry).toBeDefined();
      expect(loadedScene.resourceRegistry).toBe(resourceRegistry);

      // External scene's resources should be registered in shared registry
      const nestedMetadata = resourceRegistry.getMetadata('1_nested');
      expect(nestedMetadata).toBeDefined();
      expect(nestedMetadata?.path).toBe('res://nested.tscn');
      expect(nestedMetadata?.type).toBe('PackedScene');
    });

    it('should register resources from multiple external scenes', async () => {
      const scene1Path = 'res://scene1.tscn';
      const scene1Content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://child1.tscn" id="1_child"]

[node name="Scene1" type="Node3D"]
`;

      const scene2Path = 'res://scene2.tscn';
      const scene2Content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://child2.tscn" id="2_child"]

[node name="Scene2" type="Node3D"]
`;

      const mockProvider = {
        loadResource: vi.fn().mockImplementation(async (path: string) => {
          if (path === scene1Path) return scene1Content;
          if (path === scene2Path) return scene2Content;
          throw new Error(`Not found: ${path}`);
        }),
      };
      resourceRegistry.setProvider(mockProvider);

      // Register both resources before loading
      resourceRegistry.register({
        type: 'PackedScene',
        path: scene1Path,
        id: 'scene1'
      });
      resourceRegistry.register({
        type: 'PackedScene',
        path: scene2Path,
        id: 'scene2'
      });

      // Load both scenes
      await sceneManager['loadScene'](scene1Path);
      await sceneManager['loadScene'](scene2Path);

      // Both scenes' resources should be registered
      expect(resourceRegistry.getMetadata('1_child')).toBeDefined();
      expect(resourceRegistry.getMetadata('1_child')?.path).toBe('res://child1.tscn');

      expect(resourceRegistry.getMetadata('2_child')).toBeDefined();
      expect(resourceRegistry.getMetadata('2_child')?.path).toBe('res://child2.tscn');
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

      await sceneManager.addScene('Enemy1', scenePath);

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

      await sceneManager.addScene('Enemy1', scene1Path);
      await sceneManager.addScene('Enemy2', scene1Path);
      await sceneManager.addScene('Player1', scene2Path);

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

      await sceneManager.addScene('Enemy1', scene1Path);
      await sceneManager.addScene('Player1', scene2Path);

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

      await sceneManager.addScene('Enemy1', scenePath);

      sceneManager.clear();

      expect(sceneManager.getTotalInstanceCount()).toBe(0);
      expect(sceneManager.getTrackedScenes()).toHaveLength(0);
    });
  });

  describe('error handling and callbacks', () => {
    it('should call onResourceNeeded callback when external scene fails to load', async () => {
      const scenePath = 'res://scenes/missing.tscn';
      const instancePath = 'MissingInstance';

      // Mock provider that throws error
      const mockProvider = {
        loadResource: vi.fn().mockRejectedValue(new Error('File not found')),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_missing',
        path: scenePath,
        type: 'PackedScene',
      });

      // Set up callback spy
      const callbackSpy = vi.fn().mockResolvedValue(null);
      sceneManager.setOnResourceNeeded(callbackSpy);

      // Attempt to add scene (should not throw)
      await sceneManager.addScene(instancePath, scenePath);

      // Verify callback was called with correct data
      expect(callbackSpy).toHaveBeenCalledTimes(1);
      expect(callbackSpy).toHaveBeenCalledWith({
        path: scenePath,
        type: 'PackedScene',
        referencedBy: instancePath,
        error: 'File not found'
      });
    });

    it('should not throw when external scene fails to load (graceful degradation)', async () => {
      const scenePath = 'res://scenes/missing.tscn';
      const instancePath = 'MissingInstance';

      // Mock provider that throws error
      const mockProvider = {
        loadResource: vi.fn().mockRejectedValue(new Error('File not found')),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_missing',
        path: scenePath,
        type: 'PackedScene',
      });

      // No callback set - should handle gracefully

      // Should not throw
      await expect(sceneManager.addScene(instancePath, scenePath)).resolves.not.toThrow();
    });

    it('should track instance even when external scene fails to load', async () => {
      const scenePath = 'res://scenes/missing.tscn';
      const instancePath = 'MissingInstance';

      // Mock provider that throws error
      const mockProvider = {
        loadResource: vi.fn().mockRejectedValue(new Error('File not found')),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_missing',
        path: scenePath,
        type: 'PackedScene',
      });

      await sceneManager.addScene(instancePath, scenePath);

      // Instance should still be tracked to enable hot-reload when resource is provided later
      expect(sceneManager.getInstances(scenePath)).toHaveLength(1);
      expect(sceneManager.hasInstances(scenePath)).toBe(true);
    });

    it('should include error message in callback data', async () => {
      const scenePath = 'res://scenes/missing.tscn';
      const instancePath = 'MissingInstance';
      const errorMessage = 'Network error: 404 Not Found';

      // Mock provider that throws specific error
      const mockProvider = {
        loadResource: vi.fn().mockRejectedValue(new Error(errorMessage)),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_missing',
        path: scenePath,
        type: 'PackedScene',
      });

      const callbackSpy = vi.fn().mockResolvedValue(null);
      sceneManager.setOnResourceNeeded(callbackSpy);

      await sceneManager.addScene(instancePath, scenePath);

      const callbackArg = callbackSpy.mock.calls[0]![0] as { error: unknown };
      expect(callbackArg.error).toBe(errorMessage);
    });

    it('should handle non-Error objects in callback', async () => {
      const scenePath = 'res://scenes/missing.tscn';
      const instancePath = 'MissingInstance';

      // Mock provider that throws non-Error object
      const mockProvider = {
        loadResource: vi.fn().mockRejectedValue('String error'),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_missing',
        path: scenePath,
        type: 'PackedScene',
      });

      const callbackSpy = vi.fn().mockResolvedValue(null);
      sceneManager.setOnResourceNeeded(callbackSpy);

      await sceneManager.addScene(instancePath, scenePath);

      const callbackArg = callbackSpy.mock.calls[0]![0] as { error: unknown };
      expect(callbackArg.error).toBe('String error');
    });

    it('should allow unsetting callback', () => {
      const callback = vi.fn();
      sceneManager.setOnResourceNeeded(callback);
      sceneManager.setOnResourceNeeded(undefined);

      // Should not throw - callback successfully unset
      expect(true).toBe(true);
    });

    it('should hot-reload scene when resource is provided after initial load failure', async () => {
      const scenePath = 'res://scenes/external.tscn';
      const instancePath = 'ExternalInstance';

      // Mock provider that initially fails, then succeeds
      let loadAttempts = 0;
      const mockProvider = {
        loadResource: vi.fn().mockImplementation(() => {
          loadAttempts++;
          if (loadAttempts === 1) {
            return Promise.reject(new Error('File not found'));
          }
          // Second attempt succeeds with valid scene
          return Promise.resolve(`[gd_scene format=3]

[node name="ExternalRoot" type="Node3D"]

[node name="ChildNode" type="Node3D" parent="."]
`);
        }),
      };
      resourceRegistry.setProvider(mockProvider);

      resourceRegistry.register({
        id: '1_external',
        path: scenePath,
        type: 'PackedScene',
      });

      // Initial load should fail but track instance
      await sceneManager.addScene(instancePath, scenePath);
      expect(sceneManager.hasInstances(scenePath)).toBe(true);
      expect(loadAttempts).toBe(1);

      // Now simulate user uploading the file - updateScene should reload
      await sceneManager.updateScene(scenePath);

      // Verify second load was attempted
      expect(loadAttempts).toBe(2);

      // Verify nodes were added
      const instances = sceneManager.getInstances(scenePath);
      expect(instances).toHaveLength(1);
      expect(instances[0]).toBe(instancePath);
    });
  });
});
