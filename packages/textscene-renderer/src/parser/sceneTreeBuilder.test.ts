/**
 * Tests for Scene Tree Builder
 */

import { describe, it, expect, vi } from 'vitest';
import { buildSceneTree } from './sceneTreeBuilder';
import type { TscnNode } from './types';
import * as logger from '../logger';

describe('buildSceneTree', () => {
  describe('empty and basic cases', () => {
    it('should return empty array for empty input', () => {
      const result = buildSceneTree([]);
      expect(result).toEqual([]);
    });

    it('should handle single root node without children', () => {
      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Root',
          properties: {},
          children: [],
        },
      ];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Root');
      expect(result[0].children).toHaveLength(0);
    });

    it('should handle single root node without parent attribute', () => {
      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Root',
          properties: {},
          children: [],
        },
      ];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Root');
    });
  });

  describe('parent="." references', () => {
    it('should attach child with parent="." to root node', () => {
      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Root',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'Child',
          parent: '.',
          properties: {},
          children: [],
        },
      ];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Root');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].name).toBe('Child');
    });

    it('should attach multiple children with parent="." to root', () => {
      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Root',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'Child1',
          parent: '.',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'Child2',
          parent: '.',
          properties: {},
          children: [],
        },
      ];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(2);
      const childNames = result[0].children.map(c => c.name).sort();
      expect(childNames).toEqual(['Child1', 'Child2']);
    });
  });

  describe('named parent references', () => {
    it('should attach child to named parent', () => {
      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Root',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'Child',
          parent: '.',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'GrandChild',
          parent: 'Child',
          properties: {},
          children: [],
        },
      ];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Root');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].name).toBe('Child');
      expect(result[0].children[0].children).toHaveLength(1);
      expect(result[0].children[0].children[0].name).toBe('GrandChild');
    });

    it('should build complex multi-level hierarchy', () => {
      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Root',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'Child1',
          parent: '.',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'Child2',
          parent: '.',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'GrandChild1',
          parent: 'Child1',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'GrandChild2',
          parent: 'Child2',
          properties: {},
          children: [],
        },
      ];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      const root = result[0];
      expect(root.children).toHaveLength(2);

      const child1 = root.children.find(c => c.name === 'Child1');
      const child2 = root.children.find(c => c.name === 'Child2');

      expect(child1).toBeDefined();
      expect(child2).toBeDefined();
      expect(child1!.children).toHaveLength(1);
      expect(child1!.children[0].name).toBe('GrandChild1');
      expect(child2!.children).toHaveLength(1);
      expect(child2!.children[0].name).toBe('GrandChild2');
    });
  });

  describe('deep hierarchies', () => {
    it('should handle deep hierarchy (10 levels)', () => {
      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Level0',
          properties: {},
          children: [],
        },
      ];

      // Build 10 levels deep
      for (let i = 1; i <= 10; i++) {
        let parentPath = '.';
        if (i > 1) {
          // Build the full path to parent (e.g., "Level1/Level2" for Level3's parent)
          const pathParts = [];
          for (let j = 1; j < i; j++) {
            pathParts.push(`Level${j}`);
          }
          parentPath = pathParts.join('/');
        }
        nodes.push({
          type: 'Node3D',
          name: `Level${i}`,
          parent: parentPath,
          properties: {},
          children: [],
        });
      }

      const result = buildSceneTree(nodes);

      // Traverse down to verify depth
      let currentNode = result[0];
      for (let i = 0; i < 10; i++) {
        expect(currentNode.name).toBe(`Level${i}`);
        if (i < 10) {
          expect(currentNode.children).toHaveLength(1);
          currentNode = currentNode.children[0];
        }
      }
    });
  });

  describe('error handling', () => {
    it('should warn and treat node as root when parent not found', () => {
      const loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Root',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'Orphan',
          parent: 'NonExistentParent',
          properties: {},
          children: [],
        },
      ];

      const result = buildSceneTree(nodes);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Could not find parent "NonExistentParent" for node "Orphan"'
      );
      // Orphaned nodes are not added as additional roots (Godot requires single root)
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Root');

      loggerWarnSpy.mockRestore();
    });

    it('should handle all nodes having parent attributes (no explicit root)', () => {
      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Node1',
          parent: 'NonExistent',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'Node2',
          parent: 'NonExistent',
          properties: {},
          children: [],
        },
      ];

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = buildSceneTree(nodes);

      // All nodes should become roots when parent not found
      expect(result.length).toBeGreaterThanOrEqual(1);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('mixed scenarios', () => {
    it('should handle root with children having parent attribute', () => {
      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Root',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'Child1',
          parent: '.',
          properties: {},
          children: [],
        },
        {
          type: 'Node3D',
          name: 'Child2',
          parent: 'Child1',
          properties: {},
          children: [],
        },
      ];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Root');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].name).toBe('Child1');
      expect(result[0].children[0].children).toHaveLength(1);
      expect(result[0].children[0].children[0].name).toBe('Child2');
    });

    it('should preserve node properties during tree building', () => {
      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Root',
          properties: { customProp: 'value' },
          children: [],
        },
        {
          type: 'Node3D',
          name: 'Child',
          parent: '.',
          properties: { anotherProp: 'test' },
          children: [],
        },
      ];

      const result = buildSceneTree(nodes);

      expect(result[0].properties).toHaveProperty('customProp', 'value');
      expect(result[0].children[0].properties).toHaveProperty('anotherProp', 'test');
    });

    it('should preserve node type during tree building', () => {
      const nodes: TscnNode[] = [
        {
          type: 'Node3D',
          name: 'Root',
          properties: {},
          children: [],
        },
        {
          type: 'MeshInstance3D',
          name: 'Mesh',
          parent: '.',
          properties: {},
          children: [],
        },
      ];

      const result = buildSceneTree(nodes);

      expect(result[0].type).toBe('Node3D');
      expect(result[0].children[0].type).toBe('MeshInstance3D');
    });
  });
});
