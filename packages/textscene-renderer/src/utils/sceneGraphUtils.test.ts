import { describe, it, expect } from 'vitest';
import { findNodeByPath } from './sceneGraphUtils';
import type { TscnNode } from '../parser/types';

describe('sceneGraphUtils', () => {
  describe('findNodeByPath', () => {
    it('should find root node', () => {
      const nodes: TscnNode[] = [
        { name: 'Root', type: 'Node3D', properties: {}, children: [] },
      ];

      const result = findNodeByPath(nodes, 'Root');
      expect(result).toBe(nodes[0]);
    });

    it('should find nested child node', () => {
      const grandchild: TscnNode = { name: 'Grandchild', type: 'Node3D', properties: {}, children: [] };
      const child: TscnNode = { name: 'Child', type: 'Node3D', properties: {}, children: [grandchild] };
      const root: TscnNode = { name: 'Root', type: 'Node3D', properties: {}, children: [child] };
      const nodes = [root];

      const result = findNodeByPath(nodes, 'Root/Child/Grandchild');
      expect(result).toBe(grandchild);
    });

    it('should return null for non-existent path', () => {
      const nodes: TscnNode[] = [
        { name: 'Root', type: 'Node3D', properties: {}, children: [] },
      ];

      const result = findNodeByPath(nodes, 'Root/DoesNotExist');
      expect(result).toBeNull();
    });

    it('should find node with multiple siblings', () => {
      const child1: TscnNode = { name: 'Child1', type: 'Node3D', properties: {}, children: [] };
      const child2: TscnNode = { name: 'Child2', type: 'Node3D', properties: {}, children: [] };
      const child3: TscnNode = { name: 'Child3', type: 'Node3D', properties: {}, children: [] };
      const root: TscnNode = { name: 'Root', type: 'Node3D', properties: {}, children: [child1, child2, child3] };
      const nodes = [root];

      const result = findNodeByPath(nodes, 'Root/Child2');
      expect(result).toBe(child2);
    });

    it('should handle empty node list', () => {
      const result = findNodeByPath([], 'Root');
      expect(result).toBeNull();
    });

    it('should find node in multiple root trees', () => {
      const root1: TscnNode = { name: 'Root1', type: 'Node3D', properties: {}, children: [] };
      const child: TscnNode = { name: 'Child', type: 'Node3D', properties: {}, children: [] };
      const root2: TscnNode = { name: 'Root2', type: 'Node3D', properties: {}, children: [child] };
      const nodes = [root1, root2];

      const result = findNodeByPath(nodes, 'Root2/Child');
      expect(result).toBe(child);
    });
  });
});
