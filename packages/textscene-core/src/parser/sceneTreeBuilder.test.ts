/**
 * Tests for Scene Tree Builder
 */

import { describe, it, expect } from 'vitest';
import { buildSceneTree, rootDeclaringParent, strandedNodes } from './sceneTreeBuilder';
import type { TscnNode } from './types';

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
      expect(result[0]!.name).toBe('Root');
      expect(result[0]!.children).toHaveLength(0);
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
      expect(result[0]!.name).toBe('Root');
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
      expect(result[0]!.name).toBe('Root');
      expect(result[0]!.children).toHaveLength(1);
      expect(result[0]!.children[0]!.name).toBe('Child');
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
      expect(result[0]!.children).toHaveLength(2);
      const childNames = result[0]!.children.map(c => c.name).sort();
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
      expect(result[0]!.name).toBe('Root');
      expect(result[0]!.children).toHaveLength(1);
      expect(result[0]!.children[0]!.name).toBe('Child');
      expect(result[0]!.children[0]!.children).toHaveLength(1);
      expect(result[0]!.children[0]!.children[0]!.name).toBe('GrandChild');
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
      const root = result[0]!;
      expect(root.children).toHaveLength(2);

      const child1 = root.children.find(c => c.name === 'Child1');
      const child2 = root.children.find(c => c.name === 'Child2');

      expect(child1).toBeDefined();
      expect(child2).toBeDefined();
      expect(child1!.children).toHaveLength(1);
      expect(child1!.children[0]!.name).toBe('GrandChild1');
      expect(child2!.children).toHaveLength(1);
      expect(child2!.children[0]!.name).toBe('GrandChild2');
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
      let currentNode = result[0]!;
      for (let i = 0; i < 10; i++) {
        expect(currentNode.name).toBe(`Level${i}`);
        if (i < 10) {
          expect(currentNode.children).toHaveLength(1);
          currentNode = currentNode.children[0]!;
        }
      }
    });
  });

  describe('parents inside instanced content', () => {
    /** A node, with only the fields these tests care about. */
    const node = (name: string, extra: Partial<TscnNode> = {}): TscnNode => ({
      type: 'Node3D',
      name,
      properties: {},
      children: [],
      ...extra,
    });

    it('attaches a node whose parent path descends into an instance to that instance', () => {
      // player.tscn's shape: `Robot` names a node INSIDE player.glb, so
      // `Player/Skeleton/Skeleton3D` can never resolve against declared nodes.
      // Godot only lets you address into a sub-scene you instanced, so the
      // instance node is the anchor and the rest is its business.
      const nodes = [
        node('Main'),
        node('Player', { parent: '.', instance: 'ExtResource("3")' }),
        node('Robot', { parent: 'Player/Skeleton/Skeleton3D' }),
      ];

      const [root] = buildSceneTree(nodes);

      const player = root!.children[0]!;
      expect(player.name).toBe('Player');
      expect(player.children.map((c) => c.name)).toEqual(['Robot']);
      expect(player.children[0]!.instanceSubPath).toBe('Skeleton/Skeleton3D');
      // The authored path is untouched — the linter and the instance re-parse
      // both read it.
      expect(player.children[0]!.parent).toBe('Player/Skeleton/Skeleton3D');
    });

    it('resolves a descendant of a deep-attached node the ordinary way', () => {
      // Once `CoinCount` is placed at its declared path, `Parallax` resolves
      // through it normally and needs no marker of its own.
      const nodes = [
        node('Main'),
        node('Player', { parent: '.', instance: 'ExtResource("3")' }),
        node('CoinCount', { parent: 'Player/Skeleton' }),
        node('Parallax', { parent: 'Player/Skeleton/CoinCount' }),
      ];

      const [root] = buildSceneTree(nodes);

      const coinCount = root!.children[0]!.children[0]!;
      expect(coinCount.name).toBe('CoinCount');
      expect(coinCount.children.map((c) => c.name)).toEqual(['Parallax']);
      expect(coinCount.children[0]!.instanceSubPath).toBeUndefined();
    });

    it('anchors at the root when the root itself is the instance', () => {
      // The 2D pause menus: the scene root IS an instance of pause_menu.tscn,
      // and the override addresses a Control several levels inside it.
      const nodes = [
        node('PauseMenu', { instance: 'ExtResource("1")' }),
        node('SplitscreenButton', { parent: 'ColorRect/CenterContainer/VBoxContainer' }),
      ];

      const [root] = buildSceneTree(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['SplitscreenButton']);
      expect(root!.children[0]!.instanceSubPath).toBe('ColorRect/CenterContainer/VBoxContainer');
    });

    it('leaves a node orphaned when no ancestor on its path is an instance', () => {
      // A malformed authored path, not an instance override. Godot drops these
      // too, and so must we — otherwise a fixture named "deep" would silently
      // re-root fifteen levels as siblings and stop testing depth.
      const nodes = [node('Level0'), node('Level1', { parent: '.' }), node('Level3', { parent: 'Level2' })];

      const [root] = buildSceneTree(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['Level1']);
    });

    it('does not anchor at a plain node that merely shares the path prefix', () => {
      // `Player` here is an ordinary node, not an instance — so nothing inside
      // it can be addressed that we cannot already see, and an unresolvable
      // path is a mistake rather than an override.
      const nodes = [
        node('Main'),
        node('Player', { parent: '.' }),
        node('Robot', { parent: 'Player/Skeleton' }),
      ];

      const [root] = buildSceneTree(nodes);

      expect(root!.children[0]!.children).toEqual([]);
    });

    it('prefers the DEEPEST instance on the path', () => {
      // Nested instances: the remainder must be measured from the innermost
      // one, or the sub-path names a node the wrong scene has to resolve.
      const nodes = [
        node('Main'),
        node('Outer', { parent: '.', instance: 'ExtResource("1")' }),
        node('Inner', { parent: 'Outer', instance: 'ExtResource("2")' }),
        node('Deep', { parent: 'Outer/Inner/Body/Mesh' }),
      ];

      const [root] = buildSceneTree(nodes);

      const inner = root!.children[0]!.children[0]!;
      expect(inner.name).toBe('Inner');
      expect(inner.children[0]!.name).toBe('Deep');
      expect(inner.children[0]!.instanceSubPath).toBe('Body/Mesh');
    });
  });

  describe('error handling', () => {
    it('drops a node whose parent is not found, and reports it', () => {
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

      const origins = nodes.map((node, i) => ({ node, line: i + 1, declaredParent: node.parent }));
      const result = buildSceneTree(nodes);

      // Dropped from the tree, and named by the report rather than by a log
      // line: `strandedNodes` is the single derivation, and it is what the
      // linter and the console both read.
      expect(result.map((r) => r.name)).toEqual(['Root']);
      expect(strandedNodes(origins, result).map((o) => o.node.name)).toEqual(['Orphan']);
    });

    it('roots at heading 0 when no heading declares itself parentless', () => {
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
      const origins = nodes.map((node, i) => ({
        node,
        line: i + 1,
        declaredParent: node.parent,
      }));

      const result = buildSceneTree(nodes);

      // Handing the flat list back as roots is what this used to do, and it made
      // every node reachable — which is the set `strandedNodes` subtracts from,
      // so the report went empty on exactly the file `packed_scene.cpp:219`
      // refuses. Heading 0 is the root here as it is in the engine, and every
      // later heading is stranded and named.
      expect(result.map((r) => r.name)).toEqual(['Node1']);
      expect(strandedNodes(origins, result).map((o) => o.node.name)).toEqual(['Node2']);
      expect(rootDeclaringParent(origins)?.node.name).toBe('Node1');
    });

    it('names heading 0 even when a LATER heading became the root', () => {
      // The two derivations disagree by design: the builder prefers a parentless
      // heading wherever it sits, while Godot's root is `i == 0` and nothing
      // else. Only the positional one still names the heading that is refused.
      const nodes: TscnNode[] = [
        { type: 'Node3D', name: 'A', parent: '.', properties: {}, children: [] },
        { type: 'Node3D', name: 'Root', properties: {}, children: [] },
      ];
      const origins = nodes.map((node, i) => ({
        node,
        line: i + 1,
        declaredParent: node.parent,
      }));

      const result = buildSceneTree(nodes);

      expect(result.map((r) => r.name)).toEqual(['Root']);
      expect(strandedNodes(origins, result)).toEqual([]);
      expect(rootDeclaringParent(origins)?.node.name).toBe('A');
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
      expect(result[0]!.name).toBe('Root');
      expect(result[0]!.children).toHaveLength(1);
      expect(result[0]!.children[0]!.name).toBe('Child1');
      expect(result[0]!.children[0]!.children).toHaveLength(1);
      expect(result[0]!.children[0]!.children[0]!.name).toBe('Child2');
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

      expect(result[0]!.properties).toHaveProperty('customProp', 'value');
      expect(result[0]!.children[0]!.properties).toHaveProperty('anotherProp', 'test');
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

      expect(result[0]!.type).toBe('Node3D');
      expect(result[0]!.children[0]!.type).toBe('MeshInstance3D');
    });
  });
});
