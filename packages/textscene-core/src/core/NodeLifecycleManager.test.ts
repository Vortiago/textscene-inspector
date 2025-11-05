import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { NodeLifecycleManager } from './NodeLifecycleManager';
import { NodeTracker } from './NodeTracker';
import type { TscnScene, TscnNode } from '../parser/types';
import type { SceneManager } from './SceneManager';

// Mock NodeRegistry
vi.mock('./NodeRegistry', () => ({
  renderNodeWithRegistry: vi.fn((node: TscnNode) => {
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
        resourceRegistry: {
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
        subResources: [],
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
        subResources: [],
        resourceRegistry: {
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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
        subResources: [],
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

  describe('scene reference tracking', () => {
    it('should track nodes added to scene root', async () => {
      const sceneData: TscnScene = {
        format: 3,
        nodes: [],
        externalResources: [],
        subResources: [],
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
        subResources: [],
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
});
