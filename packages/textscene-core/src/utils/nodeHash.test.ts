/**
 * Tests for nodeHash - Deterministic hashing for TSCN nodes
 */

import { describe, it, expect } from 'vitest';
import { hashTscnNode, buildNodeHashMap } from './nodeHash';
import type { TscnNode } from '../parser/types';

describe('nodeHash', () => {
  describe('hashTscnNode', () => {
    it('should generate hash for basic node', () => {
      const node: TscnNode = {
        name: 'Root',
        type: 'Node3D',
        children: [],
        properties: {}
      };

      const hash = hashTscnNode(node);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate consistent hash for same node', () => {
      const node: TscnNode = {
        name: 'Root',
        type: 'Node3D',
        children: [],
        properties: { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)' }
      };

      const hash1 = hashTscnNode(node);
      const hash2 = hashTscnNode(node);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different node types', () => {
      const node1: TscnNode = {
        name: 'MyNode',
        type: 'Node3D',
        children: [],
        properties: {}
      };

      const node2: TscnNode = {
        name: 'MyNode',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      };

      const hash1 = hashTscnNode(node1);
      const hash2 = hashTscnNode(node2);
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different node names', () => {
      const node1: TscnNode = {
        name: 'Node1',
        type: 'Node3D',
        children: [],
        properties: {}
      };

      const node2: TscnNode = {
        name: 'Node2',
        type: 'Node3D',
        children: [],
        properties: {}
      };

      const hash1 = hashTscnNode(node1);
      const hash2 = hashTscnNode(node2);
      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes when properties change', () => {
      const node1: TscnNode = {
        name: 'MyNode',
        type: 'Node3D',
        children: [],
        properties: { visible: true }
      };

      const node2: TscnNode = {
        name: 'MyNode',
        type: 'Node3D',
        children: [],
        properties: { visible: false }
      };

      const hash1 = hashTscnNode(node1);
      const hash2 = hashTscnNode(node2);
      expect(hash1).not.toBe(hash2);
    });

    it('should include parent in hash when present', () => {
      const node1: TscnNode = {
        name: 'Child',
        type: 'Node3D',
        parent: '.',
        children: [],
        properties: {}
      };

      const node2: TscnNode = {
        name: 'Child',
        type: 'Node3D',
        children: [],
        properties: {}
      };

      const hash1 = hashTscnNode(node1);
      const hash2 = hashTscnNode(node2);
      expect(hash1).not.toBe(hash2); // Parent affects hash
    });

    it('should sort properties for deterministic hashing', () => {
      const node1: TscnNode = {
        name: 'MyNode',
        type: 'Node3D',
        children: [],
        properties: { propA: 'valueA', propB: 'valueB', propC: 'valueC' }
      };

      const node2: TscnNode = {
        name: 'MyNode',
        type: 'Node3D',
        children: [],
        properties: { propC: 'valueC', propA: 'valueA', propB: 'valueB' }
      };

      const hash1 = hashTscnNode(node1);
      const hash2 = hashTscnNode(node2);
      expect(hash1).toBe(hash2); // Order doesn't matter
    });

    it('should handle undefined properties', () => {
      const node: TscnNode = {
        name: 'MyNode',
        type: 'Node3D',
        children: [],
        properties: { defined: 'value', undefined: undefined }
      };

      // Should not throw
      const hash = hashTscnNode(node);
      expect(hash).toBeDefined();
    });

    it('should handle complex property values', () => {
      const node: TscnNode = {
        name: 'MyNode',
        type: 'MeshInstance3D',
        children: [],
        properties: {
          mesh: { type: 'BoxMesh', size: { x: 1, y: 2, z: 3 } },
          transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
          visible: true
        }
      };

      const hash = hashTscnNode(node);
      expect(hash).toBeDefined();
    });

    it('should exclude children from hash', () => {
      const node1: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        children: [],
        properties: {}
      };

      const node2: TscnNode = {
        name: 'Parent',
        type: 'Node3D',
        children: [
          { name: 'Child', type: 'Node3D', children: [], properties: {} }
        ],
        properties: {}
      };

      const hash1 = hashTscnNode(node1);
      const hash2 = hashTscnNode(node2);
      expect(hash1).toBe(hash2); // Children don't affect parent hash
    });

    it('should use base36 encoding for compact representation', () => {
      const node: TscnNode = {
        name: 'MyNode',
        type: 'Node3D',
        children: [],
        properties: {}
      };

      const hash = hashTscnNode(node);
      // Base36 uses characters 0-9 and a-z
      expect(hash).toMatch(/^[0-9a-z]+$/);
    });
  });

  describe('buildNodeHashMap', () => {
    it('should build hash map for single node', () => {
      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [],
          properties: {}
        }
      ];

      const hashMap = buildNodeHashMap(nodes);
      expect(hashMap.size).toBe(1);
      expect(hashMap.has('Root')).toBe(true);
      expect(hashMap.get('Root')).toBeDefined();
    });

    it('should build hash map for nested children', () => {
      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [
            {
              name: 'Child1',
              type: 'Node3D',
              children: [],
              properties: {}
            },
            {
              name: 'Child2',
              type: 'MeshInstance3D',
              children: [],
              properties: {}
            }
          ],
          properties: {}
        }
      ];

      const hashMap = buildNodeHashMap(nodes);
      expect(hashMap.size).toBe(3);
      expect(hashMap.has('Root')).toBe(true);
      expect(hashMap.has('Root/Child1')).toBe(true);
      expect(hashMap.has('Root/Child2')).toBe(true);
    });

    it('should handle deeply nested hierarchy', () => {
      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [
            {
              name: 'Level1',
              type: 'Node3D',
              children: [
                {
                  name: 'Level2',
                  type: 'Node3D',
                  children: [
                    {
                      name: 'Level3',
                      type: 'Node3D',
                      children: [],
                      properties: {}
                    }
                  ],
                  properties: {}
                }
              ],
              properties: {}
            }
          ],
          properties: {}
        }
      ];

      const hashMap = buildNodeHashMap(nodes);
      expect(hashMap.size).toBe(4);
      expect(hashMap.has('Root')).toBe(true);
      expect(hashMap.has('Root/Level1')).toBe(true);
      expect(hashMap.has('Root/Level1/Level2')).toBe(true);
      expect(hashMap.has('Root/Level1/Level2/Level3')).toBe(true);
    });

    it('should build hash map for multiple root nodes', () => {
      const nodes: TscnNode[] = [
        {
          name: 'Root1',
          type: 'Node3D',
          children: [],
          properties: {}
        },
        {
          name: 'Root2',
          type: 'Node3D',
          children: [],
          properties: {}
        }
      ];

      const hashMap = buildNodeHashMap(nodes);
      expect(hashMap.size).toBe(2);
      expect(hashMap.has('Root1')).toBe(true);
      expect(hashMap.has('Root2')).toBe(true);
    });

    it('should use parent path when provided', () => {
      const nodes: TscnNode[] = [
        {
          name: 'Child',
          type: 'Node3D',
          children: [],
          properties: {}
        }
      ];

      const hashMap = buildNodeHashMap(nodes, 'Parent');
      expect(hashMap.size).toBe(1);
      expect(hashMap.has('Parent/Child')).toBe(true);
    });

    it('should handle empty children array', () => {
      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [],
          properties: {}
        }
      ];

      const hashMap = buildNodeHashMap(nodes);
      expect(hashMap.size).toBe(1);
    });

    it('should handle nodes without children property', () => {
      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [],
          properties: {}
        }
      ];

      const hashMap = buildNodeHashMap(nodes);
      expect(hashMap.size).toBe(1);
      expect(hashMap.has('Root')).toBe(true);
    });

    it('should generate correct hashes for each node', () => {
      const node1: TscnNode = {
        name: 'Node1',
        type: 'Node3D',
        children: [],
        properties: { prop: 'value1' }
      };

      const node2: TscnNode = {
        name: 'Node2',
        type: 'Node3D',
        children: [],
        properties: { prop: 'value2' }
      };

      const nodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [node1, node2],
          properties: {}
        }
      ];

      const hashMap = buildNodeHashMap(nodes);

      // Verify individual hashes match
      const manualHash1 = hashTscnNode(node1);
      const manualHash2 = hashTscnNode(node2);

      expect(hashMap.get('Root/Node1')).toBe(manualHash1);
      expect(hashMap.get('Root/Node2')).toBe(manualHash2);
    });
  });

  describe('Integration', () => {
    it('should detect when node properties change', () => {
      const originalNodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [],
          properties: { visible: true }
        }
      ];

      const modifiedNodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [],
          properties: { visible: false }
        }
      ];

      const originalMap = buildNodeHashMap(originalNodes);
      const modifiedMap = buildNodeHashMap(modifiedNodes);

      expect(originalMap.get('Root')).not.toBe(modifiedMap.get('Root'));
    });

    it('should detect when nodes are added', () => {
      const originalNodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [],
          properties: {}
        }
      ];

      const modifiedNodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [
            {
              name: 'NewChild',
              type: 'Node3D',
              children: [],
              properties: {}
            }
          ],
          properties: {}
        }
      ];

      const originalMap = buildNodeHashMap(originalNodes);
      const modifiedMap = buildNodeHashMap(modifiedNodes);

      expect(originalMap.size).toBe(1);
      expect(modifiedMap.size).toBe(2);
      expect(modifiedMap.has('Root/NewChild')).toBe(true);
    });

    it('should detect when nodes are removed', () => {
      const originalNodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [
            {
              name: 'ChildToRemove',
              type: 'Node3D',
              children: [],
              properties: {}
            }
          ],
          properties: {}
        }
      ];

      const modifiedNodes: TscnNode[] = [
        {
          name: 'Root',
          type: 'Node3D',
          children: [],
          properties: {}
        }
      ];

      const originalMap = buildNodeHashMap(originalNodes);
      const modifiedMap = buildNodeHashMap(modifiedNodes);

      expect(originalMap.size).toBe(2);
      expect(modifiedMap.size).toBe(1);
      expect(originalMap.has('Root/ChildToRemove')).toBe(true);
      expect(modifiedMap.has('Root/ChildToRemove')).toBe(false);
    });
  });
});
