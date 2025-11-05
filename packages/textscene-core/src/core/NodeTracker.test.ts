/**
 * Tests for NodeTracker - synchronization of TSCN nodes and Three.js objects
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { NodeTracker } from './NodeTracker';
import type { TscnNode } from '../parser/types';

describe('NodeTracker', () => {
  let tracker: NodeTracker;

  beforeEach(() => {
    tracker = new NodeTracker();
  });

  describe('set()', () => {
    it('should add node to both maps atomically', () => {
      const object3D = new THREE.Object3D();
      const tscnNode: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/TestNode', object3D, tscnNode);

      expect(tracker.getObject('Root/TestNode')).toBe(object3D);
      expect(tracker.getNode('Root/TestNode')).toBe(tscnNode);
      expect(tracker.has('Root/TestNode')).toBe(true);
      expect(tracker.size).toBe(1);
    });

    it('should overwrite existing entry when setting same path', () => {
      const object1 = new THREE.Object3D();
      const node1: TscnNode = {
        name: 'Node1',
        type: 'Node3D',
        properties: {},
        children: []
      };

      const object2 = new THREE.Object3D();
      const node2: TscnNode = {
        name: 'Node2',
        type: 'MeshInstance3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node', object1, node1);
      tracker.set('Root/Node', object2, node2);

      expect(tracker.getObject('Root/Node')).toBe(object2);
      expect(tracker.getNode('Root/Node')).toBe(node2);
      expect(tracker.size).toBe(1);
    });

    it('should handle multiple nodes with different paths', () => {
      const object1 = new THREE.Object3D();
      const node1: TscnNode = {
        name: 'Node1',
        type: 'Node3D',
        properties: {},
        children: []
      };

      const object2 = new THREE.Object3D();
      const node2: TscnNode = {
        name: 'Node2',
        type: 'Camera3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node1', object1, node1);
      tracker.set('Root/Node2', object2, node2);

      expect(tracker.size).toBe(2);
      expect(tracker.getObject('Root/Node1')).toBe(object1);
      expect(tracker.getObject('Root/Node2')).toBe(object2);
    });
  });

  describe('delete()', () => {
    it('should remove node from both maps atomically', () => {
      const object3D = new THREE.Object3D();
      const tscnNode: TscnNode = {
        name: 'TestNode',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/TestNode', object3D, tscnNode);
      tracker.delete('Root/TestNode');

      expect(tracker.getObject('Root/TestNode')).toBeUndefined();
      expect(tracker.getNode('Root/TestNode')).toBeUndefined();
      expect(tracker.has('Root/TestNode')).toBe(false);
      expect(tracker.size).toBe(0);
    });

    it('should not throw when deleting non-existent path', () => {
      expect(() => tracker.delete('NonExistent/Path')).not.toThrow();
      expect(tracker.size).toBe(0);
    });

    it('should only delete specified path, not others', () => {
      const object1 = new THREE.Object3D();
      const node1: TscnNode = {
        name: 'Node1',
        type: 'Node3D',
        properties: {},
        children: []
      };

      const object2 = new THREE.Object3D();
      const node2: TscnNode = {
        name: 'Node2',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node1', object1, node1);
      tracker.set('Root/Node2', object2, node2);
      tracker.delete('Root/Node1');

      expect(tracker.has('Root/Node1')).toBe(false);
      expect(tracker.has('Root/Node2')).toBe(true);
      expect(tracker.size).toBe(1);
    });
  });

  describe('getObject()', () => {
    it('should return THREE.Object3D when path exists', () => {
      const object3D = new THREE.Mesh();
      const tscnNode: TscnNode = {
        name: 'Mesh',
        type: 'MeshInstance3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Mesh', object3D, tscnNode);

      const result = tracker.getObject('Root/Mesh');
      expect(result).toBe(object3D);
      expect(result).toBeInstanceOf(THREE.Mesh);
    });

    it('should return undefined when path does not exist', () => {
      expect(tracker.getObject('NonExistent/Path')).toBeUndefined();
    });
  });

  describe('getNode()', () => {
    it('should return TscnNode when path exists', () => {
      const object3D = new THREE.Object3D();
      const tscnNode: TscnNode = {
        name: 'Camera',
        type: 'Camera3D',
        properties: { fov: 75 },
        children: []
      };

      tracker.set('Root/Camera', object3D, tscnNode);

      const result = tracker.getNode('Root/Camera');
      expect(result).toBe(tscnNode);
      expect(result?.type).toBe('Camera3D');
      expect(result?.properties.fov).toBe(75);
    });

    it('should return undefined when path does not exist', () => {
      expect(tracker.getNode('NonExistent/Path')).toBeUndefined();
    });
  });

  describe('has()', () => {
    it('should return true for existing paths', () => {
      const object3D = new THREE.Object3D();
      const tscnNode: TscnNode = {
        name: 'Node',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node', object3D, tscnNode);

      expect(tracker.has('Root/Node')).toBe(true);
    });

    it('should return false for non-existent paths', () => {
      expect(tracker.has('NonExistent/Path')).toBe(false);
    });

    it('should return false after deletion', () => {
      const object3D = new THREE.Object3D();
      const tscnNode: TscnNode = {
        name: 'Node',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node', object3D, tscnNode);
      tracker.delete('Root/Node');

      expect(tracker.has('Root/Node')).toBe(false);
    });
  });

  describe('getAllPaths()', () => {
    it('should return empty array when tracker is empty', () => {
      expect(tracker.getAllPaths()).toEqual([]);
    });

    it('should return all tracked paths', () => {
      const object1 = new THREE.Object3D();
      const node1: TscnNode = {
        name: 'Node1',
        type: 'Node3D',
        properties: {},
        children: []
      };

      const object2 = new THREE.Object3D();
      const node2: TscnNode = {
        name: 'Node2',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node1', object1, node1);
      tracker.set('Root/Node2', object2, node2);

      const paths = tracker.getAllPaths();
      expect(paths).toHaveLength(2);
      expect(paths).toContain('Root/Node1');
      expect(paths).toContain('Root/Node2');
    });

    it('should return updated paths after deletion', () => {
      const object1 = new THREE.Object3D();
      const node1: TscnNode = {
        name: 'Node1',
        type: 'Node3D',
        properties: {},
        children: []
      };

      const object2 = new THREE.Object3D();
      const node2: TscnNode = {
        name: 'Node2',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node1', object1, node1);
      tracker.set('Root/Node2', object2, node2);
      tracker.delete('Root/Node1');

      const paths = tracker.getAllPaths();
      expect(paths).toHaveLength(1);
      expect(paths).toContain('Root/Node2');
      expect(paths).not.toContain('Root/Node1');
    });
  });

  describe('clear()', () => {
    it('should remove all tracked nodes', () => {
      const object1 = new THREE.Object3D();
      const node1: TscnNode = {
        name: 'Node1',
        type: 'Node3D',
        properties: {},
        children: []
      };

      const object2 = new THREE.Object3D();
      const node2: TscnNode = {
        name: 'Node2',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node1', object1, node1);
      tracker.set('Root/Node2', object2, node2);
      tracker.clear();

      expect(tracker.size).toBe(0);
      expect(tracker.getAllPaths()).toEqual([]);
      expect(tracker.has('Root/Node1')).toBe(false);
      expect(tracker.has('Root/Node2')).toBe(false);
    });

    it('should not throw when clearing empty tracker', () => {
      expect(() => tracker.clear()).not.toThrow();
      expect(tracker.size).toBe(0);
    });
  });

  describe('size', () => {
    it('should return 0 for empty tracker', () => {
      expect(tracker.size).toBe(0);
    });

    it('should return correct count after additions', () => {
      const object1 = new THREE.Object3D();
      const node1: TscnNode = {
        name: 'Node1',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node1', object1, node1);
      expect(tracker.size).toBe(1);

      const object2 = new THREE.Object3D();
      const node2: TscnNode = {
        name: 'Node2',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node2', object2, node2);
      expect(tracker.size).toBe(2);
    });

    it('should return correct count after deletions', () => {
      const object1 = new THREE.Object3D();
      const node1: TscnNode = {
        name: 'Node1',
        type: 'Node3D',
        properties: {},
        children: []
      };

      const object2 = new THREE.Object3D();
      const node2: TscnNode = {
        name: 'Node2',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node1', object1, node1);
      tracker.set('Root/Node2', object2, node2);
      tracker.delete('Root/Node1');

      expect(tracker.size).toBe(1);
    });
  });

  describe('Map Synchronization', () => {
    it('should keep both maps synchronized after set operations', () => {
      const object = new THREE.Object3D();
      const node: TscnNode = {
        name: 'Node',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node', object, node);

      // Both maps should have the entry
      expect(tracker.getObject('Root/Node')).toBeDefined();
      expect(tracker.getNode('Root/Node')).toBeDefined();
      expect(tracker.size).toBe(1);
      expect(tracker.getAllPaths()).toHaveLength(1);
    });

    it('should keep both maps synchronized after delete operations', () => {
      const object = new THREE.Object3D();
      const node: TscnNode = {
        name: 'Node',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node', object, node);
      tracker.delete('Root/Node');

      // Both maps should be empty
      expect(tracker.getObject('Root/Node')).toBeUndefined();
      expect(tracker.getNode('Root/Node')).toBeUndefined();
      expect(tracker.size).toBe(0);
      expect(tracker.getAllPaths()).toHaveLength(0);
    });

    it('should keep both maps synchronized after clear operations', () => {
      const object1 = new THREE.Object3D();
      const node1: TscnNode = {
        name: 'Node1',
        type: 'Node3D',
        properties: {},
        children: []
      };

      const object2 = new THREE.Object3D();
      const node2: TscnNode = {
        name: 'Node2',
        type: 'Node3D',
        properties: {},
        children: []
      };

      tracker.set('Root/Node1', object1, node1);
      tracker.set('Root/Node2', object2, node2);
      tracker.clear();

      // Both maps should be empty
      expect(tracker.getObject('Root/Node1')).toBeUndefined();
      expect(tracker.getNode('Root/Node1')).toBeUndefined();
      expect(tracker.getObject('Root/Node2')).toBeUndefined();
      expect(tracker.getNode('Root/Node2')).toBeUndefined();
      expect(tracker.size).toBe(0);
    });
  });
});
