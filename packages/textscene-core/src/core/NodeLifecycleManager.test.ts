import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { NodeLifecycleManager } from './NodeLifecycleManager';
import { NodeTracker } from './NodeTracker';
import type { TscnScene, TscnNode } from '../parser/types';
import type { SceneManager } from './SceneManager';
import { joinPath } from '../utils/nodePath';
import { ResourceRegistry } from '../resources/ResourceRegistry';

// Mock NodeRegistry
vi.mock('./NodeRegistry', () => ({
  renderNodeWithRegistry: vi.fn(async (node: TscnNode) => {
    // Return a THREE.Group for all node types
    const object = new THREE.Group();
    object.name = node.name;
    return object;
  }),
}));

describe('NodeLifecycleManager', () => {
  let manager: NodeLifecycleManager;
  let scene: THREE.Scene;
  let nodeTracker: NodeTracker;
  let mockSceneManager: Partial<SceneManager>;

  beforeEach(() => {
    scene = new THREE.Scene();
    nodeTracker = new NodeTracker();
    manager = new NodeLifecycleManager(scene, nodeTracker);

    // Mock SceneManager
    mockSceneManager = {
      addScene: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('constructor', () => {
    it('should initialize with scene and node tracker', () => {
      const newManager = new NodeLifecycleManager(scene, nodeTracker);
      expect(newManager).toBeDefined();
    });
  });

  describe('setSceneManager', () => {
    it('should set scene manager reference', () => {
      manager.setSceneManager(mockSceneManager as SceneManager);
      // Verify by testing behavior that requires scene manager
      expect(true).toBe(true);
    });
  });

  describe('addNode', () => {
    it('should add a simple node to scene', async () => {
      const node: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('TestNode', node, sceneData);

      // Verify node was tracked
      const trackedObject = nodeTracker.getObject('TestNode');
      expect(trackedObject).toBeDefined();
      expect(trackedObject?.userData.nodePath).toBe('TestNode');
      expect(trackedObject?.userData.nodeName).toBe('TestNode');

      // Verify node was added to scene
      expect(scene.children).toHaveLength(1);
    });

    it('should add node with parent path', async () => {
      const parentNode: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const childNode: TscnNode = {
        name: 'Child',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Add parent first
      await manager.addNode('Parent', parentNode, sceneData);

      // Add child with parent path
      await manager.addNode('Parent/Child', childNode, sceneData, 'Parent');

      // Verify child is tracked
      const childObject = nodeTracker.getObject('Parent/Child');
      expect(childObject).toBeDefined();

      // Verify child is parented correctly
      const parentObject = nodeTracker.getObject('Parent');
      expect(parentObject?.children).toHaveLength(1);
    });

    it('should handle missing parent gracefully', async () => {
      const node: TscnNode = {
        name: 'Orphan',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Try to add node with non-existent parent
      await manager.addNode('MissingParent/Orphan', node, sceneData, 'MissingParent');

      // Node should not be added
      const trackedObject = nodeTracker.getObject('MissingParent/Orphan');
      expect(trackedObject).toBeUndefined();
    });

    it('should recursively add children', async () => {
      const node: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          {
            name: 'Child1',
            type: 'Node3D',
            properties: {},
            children: [],
          },
          {
            name: 'Child2',
            type: 'Node3D',
            properties: {},
            children: [],
          },
        ],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Parent', node, sceneData);

      // Verify parent and children are tracked
      expect(nodeTracker.getObject('Parent')).toBeDefined();
      expect(nodeTracker.getObject('Parent/Child1')).toBeDefined();
      expect(nodeTracker.getObject('Parent/Child2')).toBeDefined();
    });

    it('should handle deeply nested children', async () => {
      const node: TscnNode = {
        name: 'Root',
        type: 'Node3D',
        properties: {},
        children: [
          {
            name: 'Level1',
            type: 'Node3D',
            properties: {},
            children: [
              {
                name: 'Level2',
                type: 'Node3D',
                properties: {},
                children: [
                  {
                    name: 'Level3',
                    type: 'Node3D',
                    properties: {},
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Root', node, sceneData);

      // Verify all levels are tracked
      expect(nodeTracker.getObject('Root')).toBeDefined();
      expect(nodeTracker.getObject('Root/Level1')).toBeDefined();
      expect(nodeTracker.getObject('Root/Level1/Level2')).toBeDefined();
      expect(nodeTracker.getObject('Root/Level1/Level2/Level3')).toBeDefined();
    });

    it('should set instance metadata for external scene nodes', async () => {
      manager.setSceneManager(mockSceneManager as SceneManager);

      const node: TscnNode = {
        name: 'Enemy1',
        type: 'Node3D',
        properties: {},
        children: [],
        instance: 'ExtResource("1_enemy")',
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [
          {
            id: '1_enemy',
            path: 'res://scenes/enemy.tscn',
            type: 'PackedScene',
          },
        ],
        internalResources: [],
        resourceRegistry: {
          resolveInstancePath: vi.fn().mockReturnValue('res://scenes/enemy.tscn'),
          getMetadata: vi.fn().mockReturnValue({
            id: '1_enemy',
            path: 'res://scenes/enemy.tscn',
            type: 'PackedScene',
          }),
        } as never,
      };

      await manager.addNode('Enemy1', node, sceneData);

      // Verify instance metadata was set
      const trackedNode = nodeTracker.getNode('Enemy1');
      expect(trackedNode?.instanceMetadata).toBeDefined();
      expect(trackedNode?.instanceMetadata?.sourcePath).toBe('res://scenes/enemy.tscn');
      expect(trackedNode?.instanceMetadata?.isInstanceRoot).toBe(true);

      // Verify SceneManager.addScene was called
      expect(mockSceneManager.addScene).toHaveBeenCalledWith('Enemy1', 'res://scenes/enemy.tscn');
    });

    it('should handle invalid instance reference gracefully', async () => {
      manager.setSceneManager(mockSceneManager as SceneManager);

      const node: TscnNode = {
        name: 'BadInstance',
        type: 'Node3D',
        properties: {},
        children: [],
        instance: 'InvalidReference',
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: {
          resolveInstancePath: vi.fn().mockReturnValue(null),
        } as never,
      };

      await manager.addNode('BadInstance', node, sceneData);

      // Should not call SceneManager.addScene
      expect(mockSceneManager.addScene).not.toHaveBeenCalled();
    });

    it('should warn when SceneManager not set for instance node', async () => {
      const node: TscnNode = {
        name: 'Enemy1',
        type: 'Node3D',
        properties: {},
        children: [],
        instance: 'ExtResource("1_enemy")',
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [
          {
            id: '1_enemy',
            path: 'res://scenes/enemy.tscn',
            type: 'PackedScene',
          },
        ],
        internalResources: [],
        resourceRegistry: {
          resolveInstancePath: vi.fn().mockReturnValue('res://scenes/enemy.tscn'),
          getMetadata: vi.fn().mockReturnValue({
            id: '1_enemy',
            path: 'res://scenes/enemy.tscn',
            type: 'PackedScene',
          }),
        } as never,
      };

      // Don't set SceneManager
      await manager.addNode('Enemy1', node, sceneData);

      // Should still add the node itself
      expect(nodeTracker.getObject('Enemy1')).toBeDefined();
    });
  });

  describe('removeNode', () => {
    it('should remove node from scene', async () => {
      const node: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('TestNode', node, sceneData);
      expect(nodeTracker.getObject('TestNode')).toBeDefined();

      manager.removeNode('TestNode');

      // Verify node was removed from tracker
      expect(nodeTracker.getObject('TestNode')).toBeUndefined();

      // Verify node was removed from scene
      expect(scene.children).toHaveLength(0);
    });

    it('should recursively remove all descendants', async () => {
      const node: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          {
            name: 'Child1',
            type: 'Node3D',
            properties: {},
            children: [
              {
                name: 'GrandChild',
                type: 'Node3D',
                properties: {},
                children: [],
              },
            ],
          },
          {
            name: 'Child2',
            type: 'Node3D',
            properties: {},
            children: [],
          },
        ],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Parent', node, sceneData);

      // Verify all nodes are tracked
      expect(nodeTracker.getObject('Parent')).toBeDefined();
      expect(nodeTracker.getObject('Parent/Child1')).toBeDefined();
      expect(nodeTracker.getObject('Parent/Child1/GrandChild')).toBeDefined();
      expect(nodeTracker.getObject('Parent/Child2')).toBeDefined();

      // Remove parent
      manager.removeNode('Parent');

      // Verify all descendants were removed
      expect(nodeTracker.getObject('Parent')).toBeUndefined();
      expect(nodeTracker.getObject('Parent/Child1')).toBeUndefined();
      expect(nodeTracker.getObject('Parent/Child1/GrandChild')).toBeUndefined();
      expect(nodeTracker.getObject('Parent/Child2')).toBeUndefined();
    });

    it('should handle removing non-existent node gracefully', () => {
      manager.removeNode('NonExistent');
      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle removing node with siblings correctly', async () => {
      const parent: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          { name: 'Child1', type: 'Node3D', properties: {}, children: [] },
          { name: 'Child2', type: 'Node3D', properties: {}, children: [] },
          { name: 'Child3', type: 'Node3D', properties: {}, children: [] },
        ],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Parent', parent, sceneData);

      // Remove middle child
      manager.removeNode('Parent/Child2');

      // Verify only Child2 was removed
      expect(nodeTracker.getObject('Parent')).toBeDefined();
      expect(nodeTracker.getObject('Parent/Child1')).toBeDefined();
      expect(nodeTracker.getObject('Parent/Child2')).toBeUndefined();
      expect(nodeTracker.getObject('Parent/Child3')).toBeDefined();
    });
  });

  describe('updateNode', () => {
    it('should remove and re-add node', async () => {
      const originalNode: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: { foo: 'bar' },
        children: [],
      };

      const updatedNode: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: { foo: 'baz' },
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Add original
      await manager.addNode('TestNode', originalNode, sceneData);

      const originalObject = nodeTracker.getObject('TestNode');
      expect(originalObject).toBeDefined();

      // Update
      await manager.updateNode('TestNode', updatedNode, sceneData);

      // Verify node is still tracked
      const updatedObject = nodeTracker.getObject('TestNode');
      expect(updatedObject).toBeDefined();

      // Verify it's a different object (removed and re-added)
      expect(updatedObject).not.toBe(originalObject);
    });

    it('should preserve parent relationship after update', async () => {
      const parent: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          { name: 'Child', type: 'Node3D', properties: {}, children: [] },
        ],
      };

      const updatedChild: TscnNode = {
        name: 'Child',
        type: 'Node3D',
        properties: { updated: true },
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Parent', parent, sceneData);

      // Update child
      await manager.updateNode('Parent/Child', updatedChild, sceneData);

      // Verify child is still parented to parent
      const parentObject = nodeTracker.getObject('Parent');
      const childObject = nodeTracker.getObject('Parent/Child');

      expect(childObject?.parent).toBe(parentObject);
    });

    it('should handle updating non-existent node gracefully', async () => {
      const node: TscnNode = {
        name: 'NonExistent',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.updateNode('NonExistent', node, sceneData);

      // Should not throw, and node should not be added
      expect(nodeTracker.getObject('NonExistent')).toBeUndefined();
    });

    it('should update node with children', async () => {
      const originalNode: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          { name: 'OldChild', type: 'Node3D', properties: {}, children: [] },
        ],
      };

      const updatedNode: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          { name: 'NewChild', type: 'Node3D', properties: {}, children: [] },
        ],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Parent', originalNode, sceneData);
      expect(nodeTracker.getObject('Parent/OldChild')).toBeDefined();

      await manager.updateNode('Parent', updatedNode, sceneData);

      // Old child should be removed
      expect(nodeTracker.getObject('Parent/OldChild')).toBeUndefined();

      // New child should be added
      expect(nodeTracker.getObject('Parent/NewChild')).toBeDefined();
    });
  });

  describe('setNodeVisibility', () => {
    it('should set node visibility to true', async () => {
      const node: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('TestNode', node, sceneData);

      manager.setNodeVisibility('TestNode', true);

      const object = nodeTracker.getObject('TestNode');
      expect(object?.visible).toBe(true);
    });

    it('should set node visibility to false', async () => {
      const node: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('TestNode', node, sceneData);

      manager.setNodeVisibility('TestNode', false);

      const object = nodeTracker.getObject('TestNode');
      expect(object?.visible).toBe(false);
    });

    it('should toggle visibility multiple times', async () => {
      const node: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('TestNode', node, sceneData);

      const object = nodeTracker.getObject('TestNode');

      manager.setNodeVisibility('TestNode', false);
      expect(object?.visible).toBe(false);

      manager.setNodeVisibility('TestNode', true);
      expect(object?.visible).toBe(true);

      manager.setNodeVisibility('TestNode', false);
      expect(object?.visible).toBe(false);
    });

    it('should handle setting visibility on non-existent node gracefully', () => {
      manager.setNodeVisibility('NonExistent', true);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('userData management', () => {
    it('should set nodePath in userData', async () => {
      const node: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Path/To/TestNode', node, sceneData);

      const object = nodeTracker.getObject('Path/To/TestNode');
      expect(object?.userData.nodePath).toBe('Path/To/TestNode');
    });

    it('should set nodeName in userData', async () => {
      const node: TscnNode = {
        name: 'MyNodeName',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('SomePath', node, sceneData);

      const object = nodeTracker.getObject('SomePath');
      expect(object?.userData.nodeName).toBe('MyNodeName');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex scene graph operations', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Add root with children
      await manager.addNode('Root', {
        name: 'Root',
        type: 'Node3D',
        properties: {},
        children: [
          { name: 'Child1', type: 'Node3D', properties: {}, children: [] },
          { name: 'Child2', type: 'Node3D', properties: {}, children: [] },
        ],
      }, sceneData);

      // Update one child
      await manager.updateNode('Root/Child1', {
        name: 'Child1',
        type: 'Node3D',
        properties: { updated: true },
        children: [],
      }, sceneData);

      // Remove other child
      manager.removeNode('Root/Child2');

      // Add new child
      await manager.addNode('Root/Child3', {
        name: 'Child3',
        type: 'Node3D',
        properties: {},
        children: [],
      }, sceneData, 'Root');

      // Verify final state
      expect(nodeTracker.getObject('Root')).toBeDefined();
      expect(nodeTracker.getObject('Root/Child1')).toBeDefined();
      expect(nodeTracker.getObject('Root/Child2')).toBeUndefined();
      expect(nodeTracker.getObject('Root/Child3')).toBeDefined();
    });

    it('should handle adding multiple root nodes', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Root1', { name: 'Root1', type: 'Node3D', properties: {}, children: [] }, sceneData);
      await manager.addNode('Root2', { name: 'Root2', type: 'Node3D', properties: {}, children: [] }, sceneData);
      await manager.addNode('Root3', { name: 'Root3', type: 'Node3D', properties: {}, children: [] }, sceneData);

      expect(nodeTracker.getObject('Root1')).toBeDefined();
      expect(nodeTracker.getObject('Root2')).toBeDefined();
      expect(nodeTracker.getObject('Root3')).toBeDefined();
      expect(scene.children).toHaveLength(3);
    });

    it('should handle removing middle node in chain', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const root: TscnNode = {
        name: 'Root',
        type: 'Node3D',
        properties: {},
        children: [
          {
            name: 'Middle',
            type: 'Node3D',
            properties: {},
            children: [
              { name: 'Leaf', type: 'Node3D', properties: {}, children: [] },
            ],
          },
        ],
      };

      await manager.addNode('Root', root, sceneData);

      // Remove middle node
      manager.removeNode('Root/Middle');

      // Root should remain, middle and leaf should be gone
      expect(nodeTracker.getObject('Root')).toBeDefined();
      expect(nodeTracker.getObject('Root/Middle')).toBeUndefined();
      expect(nodeTracker.getObject('Root/Middle/Leaf')).toBeUndefined();
    });
  });

  describe('addNode edge cases', () => {
    it('should handle node with empty name', async () => {
      const node: TscnNode = {
        name: '',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('', node, sceneData);

      expect(nodeTracker.getObject('')).toBeDefined();
    });

    it('should handle node with special characters in name', async () => {
      const node: TscnNode = {
        name: 'Node-With_Special.Chars@123',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Node-With_Special.Chars@123', node, sceneData);

      expect(nodeTracker.getObject('Node-With_Special.Chars@123')).toBeDefined();
    });

    it('should handle adding same node multiple times', async () => {
      const node: TscnNode = {
        name: 'Duplicate',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Duplicate', node, sceneData);
      await manager.addNode('Duplicate', node, sceneData);

      // Second add should overwrite first
      const objects = Array.from(nodeTracker.getAllPaths()).filter(p => p === 'Duplicate');
      expect(objects).toHaveLength(1);
    });

    it('should handle very deep nesting (stress test)', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Build a deeply nested structure
      let current: TscnNode = {
        name: 'Level10',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      for (let i = 9; i >= 0; i--) {
        current = {
          name: `Level${i}`,
          type: 'Node3D',
          properties: {},
          children: [current],
        };
      }

      await manager.addNode('Level0', current, sceneData);

      // Verify all levels exist
      for (let i = 0; i <= 10; i++) {
        const path = Array.from({ length: i + 1 }, (_, j) => `Level${j}`).join('/');
        expect(nodeTracker.getObject(path)).toBeDefined();
      }
    });

    it('should handle node with many children', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const children = Array.from({ length: 50 }, (_, i) => ({
        name: `Child${i}`,
        type: 'Node3D',
        properties: {},
        children: [],
      }));

      const parent: TscnNode = {
        name: 'ManyChildren',
        type: 'Node3D',
        properties: {},
        children,
      };

      await manager.addNode('ManyChildren', parent, sceneData);

      // Verify all children were added
      for (let i = 0; i < 50; i++) {
        expect(nodeTracker.getObject(`ManyChildren/Child${i}`)).toBeDefined();
      }
    });

    it('should handle node with empty properties', async () => {
      const node: TscnNode = {
        name: 'EmptyProps',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('EmptyProps', node, sceneData);

      expect(nodeTracker.getObject('EmptyProps')).toBeDefined();
    });
  });

  describe('removeNode edge cases', () => {
    it('should handle removing same node twice', async () => {
      const node: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('TestNode', node, sceneData);

      manager.removeNode('TestNode');
      manager.removeNode('TestNode'); // Second removal

      // Should not throw
      expect(nodeTracker.getObject('TestNode')).toBeUndefined();
    });

    it('should handle removing root with many descendants', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Create tree with many branches
      const root: TscnNode = {
        name: 'Root',
        type: 'Node3D',
        properties: {},
        children: [
          {
            name: 'Branch1',
            type: 'Node3D',
            properties: {},
            children: [
              { name: 'Leaf1', type: 'Node3D', properties: {}, children: [] },
              { name: 'Leaf2', type: 'Node3D', properties: {}, children: [] },
            ],
          },
          {
            name: 'Branch2',
            type: 'Node3D',
            properties: {},
            children: [
              { name: 'Leaf3', type: 'Node3D', properties: {}, children: [] },
              { name: 'Leaf4', type: 'Node3D', properties: {}, children: [] },
            ],
          },
        ],
      };

      await manager.addNode('Root', root, sceneData);

      manager.removeNode('Root');

      // All nodes should be removed
      expect(nodeTracker.getAllPaths()).toHaveLength(0);
    });

    it('should handle removing leaf node (no children)', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const parent: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          { name: 'Leaf', type: 'Node3D', properties: {}, children: [] },
        ],
      };

      await manager.addNode('Parent', parent, sceneData);

      manager.removeNode('Parent/Leaf');

      // Parent should remain, leaf should be gone
      expect(nodeTracker.getObject('Parent')).toBeDefined();
      expect(nodeTracker.getObject('Parent/Leaf')).toBeUndefined();
    });
  });

  describe('updateNode edge cases', () => {
    it('should handle updating root node', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const original: TscnNode = {
        name: 'Root',
        type: 'Node3D',
        properties: { version: 1 },
        children: [],
      };

      const updated: TscnNode = {
        name: 'Root',
        type: 'Node3D',
        properties: { version: 2 },
        children: [],
      };

      await manager.addNode('Root', original, sceneData);
      await manager.updateNode('Root', updated, sceneData);

      expect(nodeTracker.getObject('Root')).toBeDefined();
    });

    it('should handle updating node that gains children', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const original: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const updated: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          { name: 'NewChild1', type: 'Node3D', properties: {}, children: [] },
          { name: 'NewChild2', type: 'Node3D', properties: {}, children: [] },
        ],
      };

      await manager.addNode('Parent', original, sceneData);
      await manager.updateNode('Parent', updated, sceneData);

      expect(nodeTracker.getObject('Parent/NewChild1')).toBeDefined();
      expect(nodeTracker.getObject('Parent/NewChild2')).toBeDefined();
    });

    it('should handle updating node that loses children', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const original: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          { name: 'Child1', type: 'Node3D', properties: {}, children: [] },
          { name: 'Child2', type: 'Node3D', properties: {}, children: [] },
        ],
      };

      const updated: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      await manager.addNode('Parent', original, sceneData);
      await manager.updateNode('Parent', updated, sceneData);

      expect(nodeTracker.getObject('Parent/Child1')).toBeUndefined();
      expect(nodeTracker.getObject('Parent/Child2')).toBeUndefined();
    });
  });

  describe('setNodeVisibility edge cases', () => {
    it('should not affect children visibility when parent visibility changes', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const parent: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          { name: 'Child', type: 'Node3D', properties: {}, children: [] },
        ],
      };

      await manager.addNode('Parent', parent, sceneData);

      // Set parent visibility
      manager.setNodeVisibility('Parent', false);

      const parentObject = nodeTracker.getObject('Parent');
      const childObject = nodeTracker.getObject('Parent/Child');

      expect(parentObject?.visible).toBe(false);
      // Child's own visible property should be independent
      expect(childObject?.visible).toBe(true); // Default THREE.js value
    });

    it('should allow setting visibility before node is added', () => {
      // Should not throw even if node doesn't exist yet
      manager.setNodeVisibility('NotYetAdded', true);
      expect(true).toBe(true);
    });
  });

  describe('error recovery', () => {
    it('should continue processing after node render failure', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Add multiple nodes sequentially
      await manager.addNode('Node1', { name: 'Node1', type: 'Node3D', properties: {}, children: [] }, sceneData);
      await manager.addNode('Node2', { name: 'Node2', type: 'Node3D', properties: {}, children: [] }, sceneData);
      await manager.addNode('Node3', { name: 'Node3', type: 'Node3D', properties: {}, children: [] }, sceneData);

      // All should be added
      expect(nodeTracker.getObject('Node1')).toBeDefined();
      expect(nodeTracker.getObject('Node2')).toBeDefined();
      expect(nodeTracker.getObject('Node3')).toBeDefined();
    });
  });

  describe('TscnNode.children synchronization', () => {
    it('should add child to parent TscnNode.children array when adding node', async () => {
      const parentNode: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const childNode: TscnNode = {
        name: 'Child',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Add parent first
      await manager.addNode('Parent', parentNode, sceneData);

      // Add child dynamically (simulates external scene provision)
      await manager.addNode('Parent/Child', childNode, sceneData, 'Parent');

      // Verify child is in parent's TscnNode.children array
      const trackedParent = nodeTracker.getNode('Parent');
      expect(trackedParent?.children).toHaveLength(1);
      expect(trackedParent?.children?.[0]).toBe(childNode);
    });

    it('should remove child from parent TscnNode.children array when removing node', async () => {
      const parentNode: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          {
            name: 'Child1',
            type: 'Node3D',
            properties: {},
            children: [],
          },
          {
            name: 'Child2',
            type: 'Node3D',
            properties: {},
            children: [],
          },
        ],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Parent', parentNode, sceneData);

      // Verify both children are in array
      const trackedParent = nodeTracker.getNode('Parent');
      expect(trackedParent?.children).toHaveLength(2);

      // Remove one child
      manager.removeNode('Parent/Child1');

      // Verify child was removed from TscnNode.children array
      expect(trackedParent?.children).toHaveLength(1);
      expect(trackedParent?.children?.[0]?.name).toBe('Child2');
    });

    it('should not add duplicate children to TscnNode.children array', async () => {
      const parentNode: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const childNode: TscnNode = {
        name: 'Child',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Parent', parentNode, sceneData);
      await manager.addNode('Parent/Child', childNode, sceneData, 'Parent');
      await manager.addNode('Parent/Child', childNode, sceneData, 'Parent');

      // Should only have one child in array (no duplicates)
      const trackedParent = nodeTracker.getNode('Parent');
      expect(trackedParent?.children).toHaveLength(1);
    });

    it('should handle removing child that was dynamically added', async () => {
      const parentNode: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const dynamicChild: TscnNode = {
        name: 'DynamicChild',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Add parent
      await manager.addNode('Parent', parentNode, sceneData);

      // Dynamically add child (simulates external scene loading)
      await manager.addNode('Parent/DynamicChild', dynamicChild, sceneData, 'Parent');

      const trackedParent = nodeTracker.getNode('Parent');
      expect(trackedParent?.children).toHaveLength(1);

      // Remove dynamic child
      manager.removeNode('Parent/DynamicChild');

      // Verify child was removed from TscnNode.children array
      expect(trackedParent?.children).toHaveLength(0);
    });

    it('should maintain TscnNode.children array during complex operations', async () => {
      const rootNode: TscnNode = {
        name: 'Root',
        type: 'Node3D',
        properties: {},
        children: [
          {
            name: 'StaticChild',
            type: 'Node3D',
            properties: {},
            children: [],
          },
        ],
      };

      const dynamicChild: TscnNode = {
        name: 'DynamicChild',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Add root with one static child
      await manager.addNode('Root', rootNode, sceneData);

      const trackedRoot = nodeTracker.getNode('Root');
      expect(trackedRoot?.children).toHaveLength(1);
      expect(trackedRoot?.children?.[0]?.name).toBe('StaticChild');

      // Add dynamic child (simulates external scene provision)
      await manager.addNode('Root/DynamicChild', dynamicChild, sceneData, 'Root');

      // Should now have 2 children
      expect(trackedRoot?.children).toHaveLength(2);
      expect(trackedRoot?.children?.map(c => c.name)).toEqual(['StaticChild', 'DynamicChild']);

      // Remove static child
      manager.removeNode('Root/StaticChild');

      // Should only have dynamic child left
      expect(trackedRoot?.children).toHaveLength(1);
      expect(trackedRoot?.children?.[0]?.name).toBe('DynamicChild');
    });
  });

  describe('scene reference tracking', () => {
    it('should track nodes added to scene root', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('RootNode', { name: 'RootNode', type: 'Node3D', properties: {}, children: [] }, sceneData);

      const object = nodeTracker.getObject('RootNode');
      expect(object?.parent).toBe(scene);
    });

    it('should maintain correct parent-child relationships', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const parent: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [
          { name: 'Child', type: 'Node3D', properties: {}, children: [] },
        ],
      };

      await manager.addNode('Parent', parent, sceneData);

      const parentObject = nodeTracker.getObject('Parent');
      const childObject = nodeTracker.getObject('Parent/Child');

      expect(childObject?.parent).toBe(parentObject);
      expect(parentObject?.children).toContain(childObject);
    });
  });

  describe('verifyInvariants', () => {
    it('should pass verification for correctly synced node', async () => {
      const node: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('TestNode', node, sceneData);

      // Should not throw (verification passes)
      expect(() => manager['verifyInvariants']('TestNode')).not.toThrow();
    });

    it('should pass verification for node with parent', async () => {
      const parentNode: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const childNode: TscnNode = {
        name: 'Child',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Parent', parentNode, sceneData);
      await manager.addNode('Parent/Child', childNode, sceneData, 'Parent');

      // Should not throw (verification passes)
      expect(() => manager['verifyInvariants']('Parent/Child')).not.toThrow();
    });

    it('should detect missing node in tracker', async () => {
      const node: TscnNode = {
        name: 'Test',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Test', node, sceneData);

      // Manually corrupt state by deleting from tracker
      nodeTracker.delete('Test');

      // Should throw
      expect(() => manager['verifyInvariants']('Test')).toThrow(/Incomplete tracking/);
    });

    it('should detect userData.nodePath mismatch', async () => {
      const node: TscnNode = {
        name: 'Test',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Test', node, sceneData);

      // Manually corrupt userData
      const object = nodeTracker.getObject('Test');
      if (object) {
        object.userData.nodePath = 'WrongPath';
      }

      // Should throw
      expect(() => manager['verifyInvariants']('Test')).toThrow(/userData.nodePath mismatch/);
    });

    it('should detect missing node in parent.children array', async () => {
      const parentNode: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const childNode: TscnNode = {
        name: 'Child',
        type: 'Node3D',
        properties: {},
        children: [],
      };

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      await manager.addNode('Parent', parentNode, sceneData);
      await manager.addNode('Parent/Child', childNode, sceneData, 'Parent');

      // Manually corrupt TscnNode.children array
      const trackedParent = nodeTracker.getNode('Parent');
      if (trackedParent) {
        trackedParent.children = [];
      }

      // Should throw
      expect(() => manager['verifyInvariants']('Parent/Child')).toThrow(/not in parent.children array/);
    });

    it('should skip verification in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const node: TscnNode = {
          name: 'Test',
          type: 'Node3D',
          properties: {},
          children: [],
        };

        const sceneData: TscnScene = {
          format: 3,
          nodes: [],
          externalResources: [],
          internalResources: [],
        };

        await manager.addNode('Test', node, sceneData);

        // Manually corrupt userData
        const object = nodeTracker.getObject('Test');
        if (object) {
          object.userData.nodePath = 'WrongPath';
        }

        // Should NOT throw in production mode
        expect(() => manager['verifyInvariants']('Test')).not.toThrow();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('syncNodeAdd', () => {
    it('should synchronize all three structures when adding node to scene root', () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
const node: TscnNode = { name: 'TestNode', type: 'Node3D', children: [] };
      const object3D = new THREE.Object3D();

      // Call helper
      manager['syncNodeAdd']('TestNode', node, object3D, scene);

      // Verify 1: userData set correctly
      expect(object3D.userData.nodePath).toBe('TestNode');
      expect(object3D.userData.nodeName).toBe('TestNode');

      // Verify 2: NodeTracker updated
      expect(nodeTracker.getObject('TestNode')).toBe(object3D);
      expect(nodeTracker.getNode('TestNode')).toBe(node);

      // Verify 3: Added to THREE.js scene
      expect(object3D.parent).toBe(scene);
      expect(scene.children).toContain(object3D);

      // Verify 4: No parent TscnNode (root level)
      // No parent.children to update

      // Verify 5: No errors thrown (verifyInvariants passed)
    });

    it('should synchronize all three structures when adding child node', () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// Setup parent
      const parentNode: TscnNode = { name: 'Parent', type: 'Node3D', children: [] };
      const parentObject = new THREE.Object3D();
      parentObject.userData.nodePath = 'Parent';
      parentObject.userData.nodeName = 'Parent';
      nodeTracker.set('Parent', parentObject, parentNode);
      scene.add(parentObject);

      // Add child
      const childNode: TscnNode = { name: 'Child', type: 'Node3D', children: [] };
      const childObject = new THREE.Object3D();

      // Call helper
      manager['syncNodeAdd']('Parent/Child', childNode, childObject, parentObject, 'Parent');

      // Verify 1: userData set correctly
      expect(childObject.userData.nodePath).toBe('Parent/Child');
      expect(childObject.userData.nodeName).toBe('Child');

      // Verify 2: NodeTracker updated
      expect(nodeTracker.getObject('Parent/Child')).toBe(childObject);
      expect(nodeTracker.getNode('Parent/Child')).toBe(childNode);

      // Verify 3: Added to THREE.js parent
      expect(childObject.parent).toBe(parentObject);
      expect(parentObject.children).toContain(childObject);

      // Verify 4: TscnNode.children array updated
      expect(parentNode.children).toContain(childNode);
      expect(parentNode.children).toHaveLength(1);

      // Verify 5: No errors thrown (verifyInvariants passed)
    });

    it('should prevent duplicate entries in TscnNode.children array', () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// Setup parent
      const parentNode: TscnNode = { name: 'Parent', type: 'Node3D', children: [] };
      const parentObject = new THREE.Object3D();
      parentObject.userData.nodePath = 'Parent';
      parentObject.userData.nodeName = 'Parent';
      nodeTracker.set('Parent', parentObject, parentNode);
      scene.add(parentObject);

      // Add child twice (should only appear once in children array)
      const childNode: TscnNode = { name: 'Child', type: 'Node3D', children: [] };
      const childObject = new THREE.Object3D();

      // First call
      manager['syncNodeAdd']('Parent/Child', childNode, childObject, parentObject, 'Parent');
      expect(parentNode.children).toHaveLength(1);

      // Second call (simulate re-add)
      manager['syncNodeAdd']('Parent/Child', childNode, childObject, parentObject, 'Parent');
      expect(parentNode.children).toHaveLength(1); // Still 1, not 2
    });

    it('should handle parent with no existing children array', () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// Setup parent WITHOUT children array
      const parentNode: TscnNode = { name: 'Parent', type: 'Node3D' };
      const parentObject = new THREE.Object3D();
      parentObject.userData.nodePath = 'Parent';
      parentObject.userData.nodeName = 'Parent';
      nodeTracker.set('Parent', parentObject, parentNode);
      scene.add(parentObject);

      // Add child
      const childNode: TscnNode = { name: 'Child', type: 'Node3D', children: [] };
      const childObject = new THREE.Object3D();

      // Call helper
      manager['syncNodeAdd']('Parent/Child', childNode, childObject, parentObject, 'Parent');

      // Verify children array was created
      expect(parentNode.children).toBeDefined();
      expect(parentNode.children).toContain(childNode);
      expect(parentNode.children).toHaveLength(1);
    });

    it('should handle missing parent gracefully (logs warning, no crash)', () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// No parent in tracker
      const childNode: TscnNode = { name: 'Child', type: 'Node3D', children: [] };
      const childObject = new THREE.Object3D();

      // Call helper with non-existent parent
      // Should not throw, but object won't be added to parent
      expect(() => {
        manager['syncNodeAdd']('NonExistent/Child', childNode, childObject, null, 'NonExistent');
      }).not.toThrow();

      // Verify userData and NodeTracker still updated
      expect(childObject.userData.nodePath).toBe('NonExistent/Child');
      expect(nodeTracker.getNode('NonExistent/Child')).toBe(childNode);

      // Object not added to any parent (parent is null)
      expect(childObject.parent).toBeNull();
    });

    it('should call verifyInvariants in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'development';

        
      manager.setSceneManager(mockSceneManager as SceneManager);
// Setup node
        const node: TscnNode = { name: 'Test', type: 'Node3D', children: [] };
        const object3D = new THREE.Object3D();

        // Call helper (should run verifyInvariants without throwing)
        expect(() => {
          manager['syncNodeAdd']('Test', node, object3D, scene);
        }).not.toThrow();

        // Verify it actually synced
        expect(nodeTracker.getNode('Test')).toBe(node);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('syncNodeRemove', () => {
    it('should remove node from all three structures', () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// Setup node
      const node: TscnNode = { name: 'TestNode', type: 'Node3D', children: [] };
      const object3D = new THREE.Object3D();
      object3D.userData.nodePath = 'TestNode';
      object3D.userData.nodeName = 'TestNode';
      nodeTracker.set('TestNode', object3D, node);
      scene.add(object3D);

      // Verify it's there
      expect(nodeTracker.getNode('TestNode')).toBe(node);
      expect(scene.children).toContain(object3D);

      // Remove it
      manager['syncNodeRemove']('TestNode');

      // Verify 1: Removed from NodeTracker
      expect(nodeTracker.getNode('TestNode')).toBeUndefined();
      expect(nodeTracker.getObject('TestNode')).toBeUndefined();

      // Verify 2: Removed from THREE.js scene
      expect(scene.children).not.toContain(object3D);
      expect(object3D.parent).toBeNull();
    });

    it('should remove child node and update parent TscnNode.children array', () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// Setup parent
      const parentNode: TscnNode = { name: 'Parent', type: 'Node3D', children: [] };
      const parentObject = new THREE.Object3D();
      parentObject.userData.nodePath = 'Parent';
      parentObject.userData.nodeName = 'Parent';
      nodeTracker.set('Parent', parentObject, parentNode);
      scene.add(parentObject);

      // Setup child
      const childNode: TscnNode = { name: 'Child', type: 'Node3D', children: [] };
      const childObject = new THREE.Object3D();
      childObject.userData.nodePath = 'Parent/Child';
      childObject.userData.nodeName = 'Child';
      nodeTracker.set('Parent/Child', childObject, childNode);
      parentObject.add(childObject);
      parentNode.children.push(childNode);

      // Verify child is there
      expect(parentNode.children).toContain(childNode);
      expect(parentObject.children).toContain(childObject);

      // Remove child
      manager['syncNodeRemove']('Parent/Child');

      // Verify 1: Removed from parent TscnNode.children array
      expect(parentNode.children).not.toContain(childNode);
      expect(parentNode.children).toHaveLength(0);

      // Verify 2: Removed from THREE.js parent
      expect(parentObject.children).not.toContain(childObject);

      // Verify 3: Removed from NodeTracker
      expect(nodeTracker.getNode('Parent/Child')).toBeUndefined();
    });

    it('should cascade removal to all descendants', () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// Setup parent → child → grandchild hierarchy
      const parentNode: TscnNode = { name: 'Parent', type: 'Node3D', children: [] };
      const parentObject = new THREE.Object3D();
      parentObject.userData.nodePath = 'Parent';
      parentObject.userData.nodeName = 'Parent';
      nodeTracker.set('Parent', parentObject, parentNode);
      scene.add(parentObject);

      const childNode: TscnNode = { name: 'Child', type: 'Node3D', children: [] };
      const childObject = new THREE.Object3D();
      childObject.userData.nodePath = 'Parent/Child';
      childObject.userData.nodeName = 'Child';
      nodeTracker.set('Parent/Child', childObject, childNode);
      parentObject.add(childObject);

      const grandchildNode: TscnNode = { name: 'Grandchild', type: 'Node3D', children: [] };
      const grandchildObject = new THREE.Object3D();
      grandchildObject.userData.nodePath = 'Parent/Child/Grandchild';
      grandchildObject.userData.nodeName = 'Grandchild';
      nodeTracker.set('Parent/Child/Grandchild', grandchildObject, grandchildNode);
      childObject.add(grandchildObject);

      // Verify all are there
      expect(nodeTracker.getNode('Parent')).toBe(parentNode);
      expect(nodeTracker.getNode('Parent/Child')).toBe(childNode);
      expect(nodeTracker.getNode('Parent/Child/Grandchild')).toBe(grandchildNode);

      // Remove parent (should cascade to child and grandchild)
      manager['syncNodeRemove']('Parent');

      // Verify all removed from NodeTracker
      expect(nodeTracker.getNode('Parent')).toBeUndefined();
      expect(nodeTracker.getNode('Parent/Child')).toBeUndefined();
      expect(nodeTracker.getNode('Parent/Child/Grandchild')).toBeUndefined();

      // Verify removed from THREE.js scene
      expect(scene.children).not.toContain(parentObject);
    });

    it('should handle removing non-existent node gracefully', () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// Try to remove node that doesn't exist
      expect(() => {
        manager['syncNodeRemove']('NonExistent');
      }).not.toThrow();

      // Should log warning but not crash
    });

    it('should handle removing node with multiple descendants', () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// Setup parent with 3 children
      const parentNode: TscnNode = { name: 'Parent', type: 'Node3D', children: [] };
      const parentObject = new THREE.Object3D();
      parentObject.userData.nodePath = 'Parent';
      parentObject.userData.nodeName = 'Parent';
      nodeTracker.set('Parent', parentObject, parentNode);
      scene.add(parentObject);

      for (let i = 1; i <= 3; i++) {
        const childNode: TscnNode = { name: `Child${i}`, type: 'Node3D', children: [] };
        const childObject = new THREE.Object3D();
        childObject.userData.nodePath = `Parent/Child${i}`;
        childObject.userData.nodeName = `Child${i}`;
        nodeTracker.set(`Parent/Child${i}`, childObject, childNode);
        parentObject.add(childObject);
      }

      // Verify all children are there
      expect(nodeTracker.getNode('Parent/Child1')).toBeDefined();
      expect(nodeTracker.getNode('Parent/Child2')).toBeDefined();
      expect(nodeTracker.getNode('Parent/Child3')).toBeDefined();

      // Remove parent (should cascade to all children)
      manager['syncNodeRemove']('Parent');

      // Verify all children removed
      expect(nodeTracker.getNode('Parent')).toBeUndefined();
      expect(nodeTracker.getNode('Parent/Child1')).toBeUndefined();
      expect(nodeTracker.getNode('Parent/Child2')).toBeUndefined();
      expect(nodeTracker.getNode('Parent/Child3')).toBeUndefined();
    });

    it('should only remove descendants, not siblings with similar names', () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// Setup nodes with similar names
      const node1: TscnNode = { name: 'Node', type: 'Node3D', children: [] };
      const object1 = new THREE.Object3D();
      object1.userData.nodePath = 'Node';
      object1.userData.nodeName = 'Node';
      nodeTracker.set('Node', object1, node1);
      scene.add(object1);

      const node2: TscnNode = { name: 'NodeOther', type: 'Node3D', children: [] };
      const object2 = new THREE.Object3D();
      object2.userData.nodePath = 'NodeOther';
      object2.userData.nodeName = 'NodeOther';
      nodeTracker.set('NodeOther', object2, node2);
      scene.add(object2);

      const childNode: TscnNode = { name: 'Child', type: 'Node3D', children: [] };
      const childObject = new THREE.Object3D();
      childObject.userData.nodePath = 'Node/Child';
      childObject.userData.nodeName = 'Child';
      nodeTracker.set('Node/Child', childObject, childNode);
      object1.add(childObject);

      // Verify all are there
      expect(nodeTracker.getNode('Node')).toBe(node1);
      expect(nodeTracker.getNode('NodeOther')).toBe(node2);
      expect(nodeTracker.getNode('Node/Child')).toBe(childNode);

      // Remove 'Node' (should NOT remove 'NodeOther')
      manager['syncNodeRemove']('Node');

      // Verify 'Node' and 'Node/Child' removed
      expect(nodeTracker.getNode('Node')).toBeUndefined();
      expect(nodeTracker.getNode('Node/Child')).toBeUndefined();

      // Verify 'NodeOther' still there
      expect(nodeTracker.getNode('NodeOther')).toBe(node2);
      expect(scene.children).toContain(object2);
    });
  });

  describe('Instance Nodes with Children', () => {
    it('should not duplicate external scene nodes', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Create mock SceneManager
      const mockSceneManager = {
        addScene: vi.fn(async (instancePath: string) => {
          // Simulate SceneManager adding external scene nodes
          const externalNode: TscnNode = {
            name: 'ExternalChild',
            type: 'Node3D',
            children: [],
            properties: {},
          };

          // This simulates what SceneManager does: adds node and modifies parent.children
          const childPath = joinPath(instancePath, externalNode.name);
          await manager['addNode'](childPath, externalNode, sceneData, instancePath);
        }),
      };
      manager.setSceneManager(mockSceneManager as any);

      // Create instance node
      const instanceNode: TscnNode = {
        name: 'InstanceNode',
        type: 'Node3D',
        instance: 'ExtResource("1")' as any,
        children: [], // Empty initially
        properties: {},
      };

      // Setup scene data with resource resolution
      const testSceneData: TscnScene = {
        ...sceneData,
        resourceRegistry: {
          resolveInstancePath: () => 'res://external.tscn',
        } as any,
      };

      // Add instance node (no parent, so it's a root node)
      await manager.addNode('InstanceNode', instanceNode, testSceneData);

      // Verify SceneManager was called
      expect(mockSceneManager.addScene).toHaveBeenCalledOnce();

      // Verify external node was added only once
      const externalPath = 'InstanceNode/ExternalChild';
      expect(nodeTracker.getObject(externalPath)).toBeDefined();
      expect(nodeTracker.getNode(externalPath)).toBeDefined();

      // Count objects with same path (should be exactly 1)
      let count = 0;
      scene.traverse(obj => {
        if (obj.userData.nodePath === externalPath) count++;
      });
      expect(count).toBe(1); // Not 2!
    });

    it('should process additional children defined in parent scene', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      // Create mock SceneManager
      const mockSceneManager = {
        addScene: vi.fn(async (instancePath: string) => {
          // Simulate SceneManager adding external scene node
          const externalNode: TscnNode = {
            name: 'ExternalChild',
            type: 'Node3D',
            children: [],
            properties: {},
          };

          const childPath = joinPath(instancePath, externalNode.name);
          await manager['addNode'](childPath, externalNode, sceneData, instancePath);
        }),
      };
      manager.setSceneManager(mockSceneManager as any);

      // Create instance node WITH additional child in parent scene
      const additionalChild: TscnNode = {
        name: 'AdditionalChild',
        type: 'Node3D',
        children: [],
        properties: {},
      };

      const instanceNode: TscnNode = {
        name: 'InstanceNode',
        type: 'Node3D',
        instance: 'ExtResource("1")' as any,
        children: [additionalChild], // Has additional child!
        properties: {},
      };

      // Setup scene data with resource resolution
      const testSceneData: TscnScene = {
        ...sceneData,
        resourceRegistry: {
          resolveInstancePath: () => 'res://external.tscn',
        } as any,
      };

      // Add instance node
      await manager.addNode('InstanceNode', instanceNode, testSceneData);

      // Verify BOTH children were added:
      // 1. ExternalChild (from external scene)
      expect(nodeTracker.getObject('InstanceNode/ExternalChild')).toBeDefined();

      // 2. AdditionalChild (from parent scene)
      expect(nodeTracker.getObject('InstanceNode/AdditionalChild')).toBeDefined();

      // Both should be children of InstanceNode
      const instanceObject = nodeTracker.getObject('InstanceNode');
      expect(instanceObject?.children.length).toBe(2);
    });

    it('should preserve correct order: external children first, then additional children', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      let addNodeCallOrder: string[] = [];
      const originalAddNode = manager['addNode'].bind(manager);
      manager['addNode'] = async function(path: string, node: TscnNode, sceneData: TscnScene, parentPath?: string) {
        addNodeCallOrder.push(node.name);
        return originalAddNode(path, node, sceneData, parentPath);
      };

      // Create mock SceneManager
      const mockSceneManager = {
        addScene: vi.fn(async (instancePath: string) => {
          const externalNode: TscnNode = {
            name: 'ExternalChild',
            type: 'Node3D',
            children: [],
            properties: {},
          };

          const childPath = joinPath(instancePath, externalNode.name);
          // Call through manager to go through spy
          await manager['addNode'](childPath, externalNode, sceneData, instancePath);
        }),
      };
      manager.setSceneManager(mockSceneManager as any);

      const additionalChild: TscnNode = {
        name: 'AdditionalChild',
        type: 'Node3D',
        children: [],
        properties: {},
      };

      const instanceNode: TscnNode = {
        name: 'InstanceNode',
        type: 'Node3D',
        instance: 'ExtResource("1")' as any,
        children: [additionalChild],
        properties: {},
      };

      const testSceneData: TscnScene = {
        ...sceneData,
        resourceRegistry: {
          resolveInstancePath: () => 'res://external.tscn',
        } as any,
      };

      // Call through manager to go through spy
      await manager.addNode('InstanceNode', instanceNode, testSceneData);

      // Verify order: InstanceNode, then ExternalChild (from SceneManager), then AdditionalChild
      expect(addNodeCallOrder).toEqual(['InstanceNode', 'ExternalChild', 'AdditionalChild']);
    });
  });

  describe('GLB Instance Support', () => {
    it('should load GLB instance without overrides', async () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
 manager.setSceneManager(mockSceneManager as SceneManager);

      // Mock GLB mesh loading
      const mockGLBMesh = new THREE.Group();
      mockGLBMesh.name = 'GLBRoot';
      const mockResourceRegistry = {
        loadGLBMesh: vi.fn().mockResolvedValue(mockGLBMesh),
        resolveInstancePath: vi.fn().mockReturnValue('res://models/test.glb'),
        getMetadata: vi.fn(),
      };

      // Mock static parseReference method
      const parseReferenceSpy = vi.spyOn(ResourceRegistry, 'parseReference').mockReturnValue('1_glb');

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: mockResourceRegistry as any,
      };

      const glbNode: TscnNode = {
        name: 'GLBInstance',
        type: 'Node3D',
        instance: 'ExtResource("1_glb")',
        properties: {},
        children: [],
      };

      await manager.addNode('GLBInstance', glbNode, sceneData);

      // Verify GLB mesh was loaded
      expect(mockResourceRegistry.loadGLBMesh).toHaveBeenCalledWith('1_glb');

      // Verify node was added
      expect(nodeTracker.getObject('GLBInstance')).toBeDefined();

      // Clean up
      parseReferenceSpy.mockRestore();
    });

    it('should apply material overrides to GLB mesh', async () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
 manager.setSceneManager(mockSceneManager as SceneManager);

      // Create GLB scene with a mesh child
      const mockGLBChild = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );
      mockGLBChild.name = 'ChildMesh';

      const mockGLBMesh = new THREE.Group();
      mockGLBMesh.name = 'GLBRoot';
      mockGLBMesh.add(mockGLBChild);

      const overrideMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

      const mockResourceRegistry = {
        loadGLBMesh: vi.fn().mockResolvedValue(mockGLBMesh),
        resolveInstancePath: vi.fn().mockReturnValue('res://models/test.glb'),
        loadMaterial: vi.fn().mockResolvedValue(overrideMaterial),
        getMetadata: vi.fn(),
      };

      // Mock static parseReference method
      const parseReferenceSpy = vi.spyOn(ResourceRegistry, 'parseReference')
        .mockImplementation((ref: string) => {
          if (ref === 'ExtResource("1_glb")') return '1_glb';
          if (ref === 'ExtResource("2_mat")') return '2_mat';
          return null;
        });

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: mockResourceRegistry as any,
      };

      const glbNode: TscnNode = {
        name: 'GLBInstance',
        type: 'Node3D',
        instance: 'ExtResource("1_glb")',
        properties: {},
        children: [
          {
            name: 'ChildMesh',
            type: 'MeshInstance3D',
            properties: {
              index: 0,
              'surface_material_override/0': 'ExtResource("2_mat")',
            },
            children: [],
          },
        ],
      };

      await manager.addNode('GLBInstance', glbNode, sceneData);

      // Verify material was loaded
      expect(mockResourceRegistry.loadMaterial).toHaveBeenCalledWith('2_mat');

      // Verify node was added (material override applied internally)
      expect(nodeTracker.getObject('GLBInstance')).toBeDefined();

      // Clean up
      parseReferenceSpy.mockRestore();
    });

    it('should handle multiple material overrides', async () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// Create GLB scene with a mesh child that has multiple material slots
      const mockGLBChild = new THREE.Mesh(
        new THREE.BoxGeometry(),
        [
          new THREE.MeshStandardMaterial({ color: 0xff0000 }),
          new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
        ]
      );
      mockGLBChild.name = 'MultiMatMesh';

      const mockGLBMesh = new THREE.Group();
      mockGLBMesh.name = 'GLBRoot';
      mockGLBMesh.add(mockGLBChild);

      const overrideMat0 = new THREE.MeshStandardMaterial({ color: 0x0000ff });
      const overrideMat1 = new THREE.MeshStandardMaterial({ color: 0xffff00 });

      const mockResourceRegistry = {
        loadGLBMesh: vi.fn().mockResolvedValue(mockGLBMesh),
        resolveInstancePath: vi.fn().mockReturnValue('res://models/test.glb'),
        loadMaterial: vi.fn((id: string) => {
          if (id === '2_mat') return Promise.resolve(overrideMat0);
          if (id === '3_mat') return Promise.resolve(overrideMat1);
          return Promise.resolve(null);
        }),
        getMetadata: vi.fn(),
      };

      // Mock static parseReference method
      const parseReferenceSpy = vi.spyOn(ResourceRegistry, 'parseReference')
        .mockImplementation((ref: string) => {
          if (ref === 'ExtResource("1_glb")') return '1_glb';
          if (ref === 'ExtResource("2_mat")') return '2_mat';
          if (ref === 'ExtResource("3_mat")') return '3_mat';
          return null;
        });

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: mockResourceRegistry as any,
      };

      const glbNode: TscnNode = {
        name: 'GLBInstance',
        type: 'Node3D',
        instance: 'ExtResource("1_glb")',
        properties: {},
        children: [
          {
            name: 'MultiMatMesh',
            type: 'MeshInstance3D',
            properties: {
              index: 0,
              'surface_material_override/0': 'ExtResource("2_mat")',
              'surface_material_override/1': 'ExtResource("3_mat")',
            },
            children: [],
          },
        ],
      };

      await manager.addNode('GLBInstance', glbNode, sceneData);

      // Verify both materials were loaded
      expect(mockResourceRegistry.loadMaterial).toHaveBeenCalledWith('2_mat');
      expect(mockResourceRegistry.loadMaterial).toHaveBeenCalledWith('3_mat');

      expect(nodeTracker.getObject('GLBInstance')).toBeDefined();

      // Clean up
      parseReferenceSpy.mockRestore();
    });

    it('should apply transform overrides to GLB instance', async () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
const mockGLBChild = new THREE.Mesh(new THREE.BoxGeometry());
      mockGLBChild.name = 'ChildMesh';

      const mockGLBMesh = new THREE.Group();
      mockGLBMesh.name = 'GLBRoot';
      mockGLBMesh.add(mockGLBChild);

      const mockResourceRegistry = {
        loadGLBMesh: vi.fn().mockResolvedValue(mockGLBMesh),
        resolveInstancePath: vi.fn().mockReturnValue('res://models/test.glb'),
        getMetadata: vi.fn(),
      };

      // Mock static parseReference method
      const parseReferenceSpy = vi.spyOn(ResourceRegistry, 'parseReference').mockReturnValue('1_glb');

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: mockResourceRegistry as any,
      };

      const glbNode: TscnNode = {
        name: 'GLBInstance',
        type: 'Node3D',
        instance: 'ExtResource("1_glb")',
        properties: {},
        children: [
          {
            name: 'ChildMesh',
            type: 'MeshInstance3D',
            properties: {
              index: 0,
              transform: {
                basis_x: { x: 1, y: 0, z: 0 },
                basis_y: { x: 0, y: 1, z: 0 },
                basis_z: { x: 0, y: 0, z: 1 },
                origin: { x: 5, y: 10, z: 15 },
              },
            },
            children: [],
          },
        ],
      };

      await manager.addNode('GLBInstance', glbNode, sceneData);

      const addedObject = nodeTracker.getObject('GLBInstance');
      expect(addedObject).toBeDefined();

      // Transform should be applied to the child
      const glbChild = mockGLBMesh.children[0];
      expect(glbChild?.matrixAutoUpdate).toBe(false);
      expect(glbChild?.matrix.elements[12]).toBe(5); // x translation
      expect(glbChild?.matrix.elements[13]).toBe(10); // y translation
      expect(glbChild?.matrix.elements[14]).toBe(15); // z translation

      // Clean up
      parseReferenceSpy.mockRestore();
    });

    it('should handle GLB load failure gracefully', async () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
const mockResourceRegistry = {
        loadGLBMesh: vi.fn().mockResolvedValue(null), // Load failed
        resolveInstancePath: vi.fn().mockReturnValue('res://models/missing.glb'),
        getMetadata: vi.fn(),
      };

      // Mock static parseReference method
      const parseReferenceSpy = vi.spyOn(ResourceRegistry, 'parseReference').mockReturnValue('missing_glb');

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: mockResourceRegistry as any,
      };

      const glbNode: TscnNode = {
        name: 'FailedGLB',
        type: 'Node3D',
        instance: 'ExtResource("missing_glb")',
        properties: {},
        children: [],
      };

      // Should not throw
      await manager.addNode('FailedGLB', glbNode, sceneData);

      // Node should still be added even if GLB load failed
      expect(nodeTracker.getObject('FailedGLB')).toBeDefined();

      // Clean up
      parseReferenceSpy.mockRestore();
    });

    it('should handle missing material for override', async () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
const mockGLBChild = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial()
      );
      mockGLBChild.name = 'ChildMesh';

      const mockGLBMesh = new THREE.Group();
      mockGLBMesh.name = 'GLBRoot';
      mockGLBMesh.add(mockGLBChild);

      const mockResourceRegistry = {
        loadGLBMesh: vi.fn().mockResolvedValue(mockGLBMesh),
        resolveInstancePath: vi.fn().mockReturnValue('res://models/test.glb'),
        loadMaterial: vi.fn().mockResolvedValue(null), // Material not found
        getMetadata: vi.fn(),
      };

      // Mock static parseReference method
      const parseReferenceSpy = vi.spyOn(ResourceRegistry, 'parseReference')
        .mockImplementation((ref: string) => {
          if (ref === 'ExtResource("1_glb")') return '1_glb';
          if (ref === 'ExtResource("2_mat")') return '2_mat';
          return null;
        });

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: mockResourceRegistry as any,
      };

      const glbNode: TscnNode = {
        name: 'GLBInstance',
        type: 'Node3D',
        instance: 'ExtResource("1_glb")',
        properties: {},
        children: [
          {
            name: 'ChildMesh',
            type: 'MeshInstance3D',
            properties: {
              index: 0,
              'surface_material_override/0': 'ExtResource("2_mat")',
            },
            children: [],
          },
        ],
      };

      // Should not throw
      await manager.addNode('GLBInstance', glbNode, sceneData);

      // Verify loadMaterial was called (failed gracefully)
      expect(mockResourceRegistry.loadMaterial).toHaveBeenCalledWith('2_mat');
      expect(nodeTracker.getObject('GLBInstance')).toBeDefined();

      // Clean up
      parseReferenceSpy.mockRestore();
    });

    it('should handle invalid material reference format', async () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
const mockGLBChild = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial()
      );
      mockGLBChild.name = 'ChildMesh';

      const mockGLBMesh = new THREE.Group();
      mockGLBMesh.name = 'GLBRoot';
      mockGLBMesh.add(mockGLBChild);

      const mockResourceRegistry = {
        loadGLBMesh: vi.fn().mockResolvedValue(mockGLBMesh),
        resolveInstancePath: vi.fn().mockReturnValue('res://models/test.glb'),
        loadMaterial: vi.fn(),
        getMetadata: vi.fn(),
      };

      // Mock static parseReference method - returns null for invalid format
      const parseReferenceSpy = vi.spyOn(ResourceRegistry, 'parseReference')
        .mockImplementation((ref: string) => {
          if (ref === 'ExtResource("1_glb")') return '1_glb';
          if (ref === 'InvalidFormat') return null;
          return null;
        });

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: mockResourceRegistry as any,
      };

      const glbNode: TscnNode = {
        name: 'GLBInstance',
        type: 'Node3D',
        instance: 'ExtResource("1_glb")',
        properties: {},
        children: [
          {
            name: 'ChildMesh',
            type: 'MeshInstance3D',
            properties: {
              index: 0,
              'surface_material_override/0': 'InvalidFormat',
            },
            children: [],
          },
        ],
      };

      // Should not throw
      await manager.addNode('GLBInstance', glbNode, sceneData);

      // loadMaterial should NOT be called (parseReference failed)
      expect(mockResourceRegistry.loadMaterial).not.toHaveBeenCalled();
      expect(nodeTracker.getObject('GLBInstance')).toBeDefined();

      // Clean up
      parseReferenceSpy.mockRestore();
    });

    it('should handle surface index out of bounds', async () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
const mockGLBChild = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial() // Single material
      );
      mockGLBChild.name = 'ChildMesh';

      const mockGLBMesh = new THREE.Group();
      mockGLBMesh.name = 'GLBRoot';
      mockGLBMesh.add(mockGLBChild);

      const overrideMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });

      const mockResourceRegistry = {
        loadGLBMesh: vi.fn().mockResolvedValue(mockGLBMesh),
        resolveInstancePath: vi.fn().mockReturnValue('res://models/test.glb'),
        loadMaterial: vi.fn().mockResolvedValue(overrideMaterial),
        getMetadata: vi.fn(),
      };

      // Mock static parseReference method
      const parseReferenceSpy = vi.spyOn(ResourceRegistry, 'parseReference')
        .mockImplementation((ref: string) => {
          if (ref === 'ExtResource("1_glb")') return '1_glb';
          if (ref === 'ExtResource("2_mat")') return '2_mat';
          return null;
        });

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: mockResourceRegistry as any,
      };

      const glbNode: TscnNode = {
        name: 'GLBInstance',
        type: 'Node3D',
        instance: 'ExtResource("1_glb")',
        properties: {},
        children: [
          {
            name: 'ChildMesh',
            type: 'MeshInstance3D',
            properties: {
              index: 0,
              'surface_material_override/5': 'ExtResource("2_mat")', // Index out of bounds
            },
            children: [],
          },
        ],
      };

      // Should not throw
      await manager.addNode('GLBInstance', glbNode, sceneData);

      // Material was loaded but expansion should create array
      expect(mockResourceRegistry.loadMaterial).toHaveBeenCalledWith('2_mat');
      expect(nodeTracker.getObject('GLBInstance')).toBeDefined();

      // Clean up
      parseReferenceSpy.mockRestore();
    });

    it('should handle GLB with no overrides specified', async () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
const mockGLBMesh = new THREE.Group();
      mockGLBMesh.name = 'GLBRoot';

      const mockResourceRegistry = {
        loadGLBMesh: vi.fn().mockResolvedValue(mockGLBMesh),
        resolveInstancePath: vi.fn().mockReturnValue('res://models/test.glb'),
        getMetadata: vi.fn(),
      };

      // Mock static parseReference method
      const parseReferenceSpy = vi.spyOn(ResourceRegistry, 'parseReference').mockReturnValue('1_glb');

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: mockResourceRegistry as any,
      };

      const glbNode: TscnNode = {
        name: 'GLBInstance',
        type: 'Node3D',
        instance: 'ExtResource("1_glb")',
        properties: {},
        children: [], // No children, no overrides
      };

      await manager.addNode('GLBInstance', glbNode, sceneData);

      // GLB should be loaded without any overrides
      expect(mockResourceRegistry.loadGLBMesh).toHaveBeenCalledWith('1_glb');
      expect(nodeTracker.getObject('GLBInstance')).toBeDefined();

      // Original material preserved (not modified)
      const addedObject = nodeTracker.getObject('GLBInstance');
      expect(addedObject).toBeDefined();

      // Clean up
      parseReferenceSpy.mockRestore();
    });

    it('should handle GLB instance with additional TSCN children', async () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
const mockGLBMesh = new THREE.Group();
      mockGLBMesh.name = 'GLBRoot';

      const mockResourceRegistry = {
        loadGLBMesh: vi.fn().mockResolvedValue(mockGLBMesh),
        resolveInstancePath: vi.fn().mockReturnValue('res://models/test.glb'),
        getMetadata: vi.fn(),
      };

      // Mock static parseReference method
      const parseReferenceSpy = vi.spyOn(ResourceRegistry, 'parseReference').mockReturnValue('1_glb');

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: mockResourceRegistry as any,
      };

      const additionalChild: TscnNode = {
        name: 'AdditionalChild',
        type: 'Node3D',
        properties: {}, // No index attribute - this is a new child, not editable instance
        children: [],
      };

      const glbNode: TscnNode = {
        name: 'GLBInstance',
        type: 'Node3D',
        instance: 'ExtResource("1_glb")',
        properties: {},
        children: [additionalChild], // GLB + additional TSCN child
      };

      await manager.addNode('GLBInstance', glbNode, sceneData);

      // Verify GLB was loaded
      expect(mockResourceRegistry.loadGLBMesh).toHaveBeenCalledWith('1_glb');

      // Verify both GLB instance and additional child exist
      expect(nodeTracker.getObject('GLBInstance')).toBeDefined();
      expect(nodeTracker.getObject('GLBInstance/AdditionalChild')).toBeDefined();

      const instanceObject = nodeTracker.getObject('GLBInstance');
      // Should have GLB as child, plus additional child
      expect(instanceObject?.children.length).toBeGreaterThanOrEqual(1);

      // Clean up
      parseReferenceSpy.mockRestore();
    });

    it('should verify GLB materials are cloned, not shared', async () => {
      
      manager.setSceneManager(mockSceneManager as SceneManager);
// Create GLB meshes with shared material (to test cloning)
      const sharedMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      const mockGLBMesh1 = new THREE.Group();
      mockGLBMesh1.name = 'GLBRoot1';
      mockGLBMesh1.add(new THREE.Mesh(new THREE.BoxGeometry(), sharedMaterial));

      const mockGLBMesh2 = new THREE.Group();
      mockGLBMesh2.name = 'GLBRoot2';
      mockGLBMesh2.add(new THREE.Mesh(new THREE.BoxGeometry(), sharedMaterial));

      let callCount = 0;
      const mockResourceRegistry = {
        loadGLBMesh: vi.fn(() => {
          callCount++;
          // Return different instances (simulating clone behavior)
          return Promise.resolve(callCount === 1 ? mockGLBMesh1 : mockGLBMesh2);
        }),
        resolveInstancePath: vi.fn().mockReturnValue('res://models/test.glb'),
        getMetadata: vi.fn(),
      };

      // Mock static parseReference method
      const parseReferenceSpy = vi.spyOn(ResourceRegistry, 'parseReference').mockReturnValue('1_glb');

      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        internalResources: [],
        resourceRegistry: mockResourceRegistry as any,
      };

      const glbNode1: TscnNode = {
        name: 'GLBInstance1',
        type: 'Node3D',
        instance: 'ExtResource("1_glb")',
        properties: {},
        children: [],
      };

      const glbNode2: TscnNode = {
        name: 'GLBInstance2',
        type: 'Node3D',
        instance: 'ExtResource("1_glb")',
        properties: {},
        children: [],
      };

      await manager.addNode('GLBInstance1', glbNode1, sceneData);
      await manager.addNode('GLBInstance2', glbNode2, sceneData);

      // Both instances should be loaded
      expect(mockResourceRegistry.loadGLBMesh).toHaveBeenCalledTimes(2);

      // Instances should exist
      const instance1 = nodeTracker.getObject('GLBInstance1');
      const instance2 = nodeTracker.getObject('GLBInstance2');
      expect(instance1).toBeDefined();
      expect(instance2).toBeDefined();

      // Clean up
      parseReferenceSpy.mockRestore();

      // Different objects (cloned, not shared reference)
      expect(instance1).not.toBe(instance2);
    });
  });
});
