/**
 * Tests for Scene Tree Builder
 */

import { describe, it, expect } from 'vitest';
import { buildSceneTree, strandedNodes } from './sceneTreeBuilder';
import type { TscnNode } from './types';

/** A childless `Node3D`, a root when `parent` is absent. */
function node(name: string, parent?: string): TscnNode {
  const root: TscnNode = { rawProperties: {}, type: 'Node3D', name, properties: {}, children: [] };
  return parent === undefined ? root : { ...root, parent };
}

describe('buildSceneTree', () => {
  describe('empty and basic cases', () => {
    it('should return empty array for empty input', () => {
      const result = buildSceneTree([]);
      expect(result).toEqual([]);
    });

    it('should handle single root node without children', () => {
      const nodes: TscnNode[] = [node('Root')];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Root');
      expect(result[0]!.children).toHaveLength(0);
    });

    it('should handle single root node without parent attribute', () => {
      const nodes: TscnNode[] = [node('Root')];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Root');
    });
  });

  describe('parent="." references', () => {
    it('should attach child with parent="." to root node', () => {
      const nodes: TscnNode[] = [node('Root'), node('Child', '.')];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Root');
      expect(result[0]!.children).toHaveLength(1);
      expect(result[0]!.children[0]!.name).toBe('Child');
    });

    it('should attach multiple children with parent="." to root', () => {
      const nodes: TscnNode[] = [node('Root'), node('Child1', '.'), node('Child2', '.')];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      expect(result[0]!.children).toHaveLength(2);
      const childNames = result[0]!.children.map((c) => c.name).sort();
      expect(childNames).toEqual(['Child1', 'Child2']);
    });
  });

  describe('named parent references', () => {
    it('should attach child to named parent', () => {
      const nodes: TscnNode[] = [node('Root'), node('Child', '.'), node('GrandChild', 'Child')];

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
        node('Root'),
        node('Child1', '.'),
        node('Child2', '.'),
        node('GrandChild1', 'Child1'),
        node('GrandChild2', 'Child2'),
      ];

      const result = buildSceneTree(nodes);

      expect(result).toHaveLength(1);
      const root = result[0]!;
      expect(root.children).toHaveLength(2);

      const child1 = root.children.find((c) => c.name === 'Child1');
      const child2 = root.children.find((c) => c.name === 'Child2');

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
      const nodes: TscnNode[] = [node('Level0')];

      // Build 10 levels deep
      for (let i = 1; i <= 10; i++) {
        let parentPath = '.';
        if (i > 1) {
          // The full parent path, for example "Level1/Level2" for Level3.
          const pathParts = [];
          for (let j = 1; j < i; j++) {
            pathParts.push(`Level${j}`);
          }
          parentPath = pathParts.join('/');
        }
        nodes.push(node(`Level${i}`, parentPath));
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
    /** A `Node3D` with `fields` over it, for a test that sets more than its parent. */
    const nodeWith = (name: string, fields: Partial<TscnNode>): TscnNode => ({ ...node(name), ...fields });

    it('attaches a node whose parent path descends into an instance to that instance', () => {
      // player.tscn's shape: `Robot` names a node INSIDE player.glb, so
      // `Player/Skeleton/Skeleton3D` can never resolve against declared nodes.
      // Godot only lets you address into a sub-scene you instanced, so the
      // instance node is the anchor and the rest is its business.
      const nodes = [
        node('Main'),
        nodeWith('Player', { parent: '.', instance: 'ExtResource("3")' }),
        node('Robot', 'Player/Skeleton/Skeleton3D'),
      ];

      const [root] = buildSceneTree(nodes);

      const player = root!.children[0]!;
      expect(player.name).toBe('Player');
      expect(player.children.map((c) => c.name)).toEqual(['Robot']);
      expect(player.children[0]!.instanceSubPath).toBe('Skeleton/Skeleton3D');
      // The authored path is untouched: the linter and the instance re-parse read it.
      expect(player.children[0]!.parent).toBe('Player/Skeleton/Skeleton3D');
    });

    it('resolves a descendant of a deep-attached node the ordinary way', () => {
      // Once `CoinCount` is placed at its declared path, `Parallax` resolves
      // through it normally and needs no marker of its own.
      const nodes = [
        node('Main'),
        nodeWith('Player', { parent: '.', instance: 'ExtResource("3")' }),
        node('CoinCount', 'Player/Skeleton'),
        node('Parallax', 'Player/Skeleton/CoinCount'),
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
        nodeWith('PauseMenu', { instance: 'ExtResource("1")' }),
        node('SplitscreenButton', 'ColorRect/CenterContainer/VBoxContainer'),
      ];

      const [root] = buildSceneTree(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['SplitscreenButton']);
      expect(root!.children[0]!.instanceSubPath).toBe('ColorRect/CenterContainer/VBoxContainer');
    });

    it('leaves a node orphaned when no ancestor on its path is an instance', () => {
      // A malformed authored path, not an instance override, which Godot drops too.
      // Re-rooting it would flatten a "deep" fixture's fifteen levels into siblings.
      const nodes = [node('Level0'), node('Level1', '.'), node('Level3', 'Level2')];

      const [root] = buildSceneTree(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['Level1']);
    });

    it('does not anchor at a plain node that merely shares the path prefix', () => {
      // `Player` is an ordinary node, not an instance, so everything inside it is
      // visible here and an unresolvable path is a mistake, not an override.
      const nodes = [node('Main'), node('Player', '.'), node('Robot', 'Player/Skeleton')];

      const [root] = buildSceneTree(nodes);

      expect(root!.children[0]!.children).toEqual([]);
    });

    it('descends through an override heading standing between the instance and the path', () => {
      // Godot's shape for editable children: `Inside` overrides a node the base scene
      // declares, with no `type=`, and its children live in that scene. Read as an
      // ordinary node, it would strand `StaticBody2D`, which the engine places.
      const nodes = [
        node('Root'),
        nodeWith('Building', { parent: '.', instance: 'ExtResource("1")' }),
        nodeWith('Inside', { parent: 'Building', type: 'Node', overridesExistingNode: true }),
        node('CollisionPolygon2D', 'Building/Inside/StaticBody2D'),
      ];

      const [root] = buildSceneTree(nodes);

      const building = root!.children[0]!;
      expect(building.children.map((c) => c.name)).toEqual(['Inside', 'CollisionPolygon2D']);
      expect(building.children[1]!.instanceSubPath).toBe('Inside/StaticBody2D');
    });

    it('descends through an override heading below an instanced ROOT', () => {
      // The inherited-scene shape: the root itself is the instance, so every
      // override below it names base-scene content and the same opacity applies
      // from the scene root down.
      const nodes = [
        nodeWith('Root', { instance: 'ExtResource("1")' }),
        nodeWith('Mid', { parent: '.', type: 'Node', overridesExistingNode: true }),
        node('Leaf', 'Mid/Ghost'),
      ];

      const [root] = buildSceneTree(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['Mid', 'Leaf']);
      expect(root!.children[1]!.instanceSubPath).toBe('Mid/Ghost');
    });

    it('jumps a %Name in a parent= to the node claiming it', () => {
      // `get_node_or_null` looks a `%Name` up in the owner's claim table rather
      // than descending (`node.cpp:1930-1938`), so the path continues from
      // whatever it finds.
      const nodes = [
        node('Root'),
        nodeWith('Player', {
          parent: '.',
          rawProperties: { unique_name_in_owner: 'true' },
        }),
        node('Hat', '%Player'),
      ];

      const [root] = buildSceneTree(nodes);

      const player = root!.children[0]!;
      expect(player.name).toBe('Player');
      expect(player.children.map((c) => c.name)).toEqual(['Hat']);
    });

    it('strands a %Name whose claim is declared LATER in the file', () => {
      // The table holds only what the headings before this one seated, so the
      // claim is not there yet. Probed on 4.7.2: Godot warns "Parent path
      // './%Player' for node 'Hat' has vanished" and renames it `_Player#Hat`.
      const nodes = [
        node('Root'),
        node('Hat', '%Player'),
        nodeWith('Player', {
          parent: '.',
          rawProperties: { unique_name_in_owner: 'true' },
        }),
      ];

      const [root] = buildSceneTree(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['Player']);
      expect(root!.children[0]!.children).toEqual([]);
    });

    it('strands a %Name no node in the file claims', () => {
      // Without the flag there is no claim, and Godot warns the parent path has
      // vanished rather than treating `%Player` as an ordinary child name.
      const nodes = [node('Root'), node('Player', '.'), node('Hat', '%Player')];

      const [root] = buildSceneTree(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['Player']);
      expect(root!.children[0]!.children).toEqual([]);
    });

    it('strands a parent= naming a node declared LATER in the file', () => {
      // `NODE_FROM_ID` resolves against the tree at heading `i`
      // (`packed_scene.cpp:157-165`), so only headings above are reachable. Probed on
      // 4.7.2: `Body` re-roots as `Later#Body` with a warning, and swapped it seats.
      const nodes = [node('Root'), node('Body', 'Later'), node('Later', '.')];

      const [root] = buildSceneTree(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['Later']);
      expect(root!.children[0]!.children).toEqual([]);
    });

    it('prefers the DEEPEST instance on the path', () => {
      // Nested instances: the remainder must be measured from the innermost
      // one, or the sub-path names a node the wrong scene has to resolve.
      const nodes = [
        node('Main'),
        nodeWith('Outer', { parent: '.', instance: 'ExtResource("1")' }),
        nodeWith('Inner', { parent: 'Outer', instance: 'ExtResource("2")' }),
        node('Deep', 'Outer/Inner/Body/Mesh'),
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
      const nodes: TscnNode[] = [node('Root'), node('Orphan', 'NonExistentParent')];

      const origins = nodes.map((node, i) => ({ node, line: i + 1, declaredParent: node.parent }));
      const result = buildSceneTree(nodes);

      // Dropped from the tree, and named by the report rather than by a log
      // line: `strandedNodes` is the single derivation, and it is what the
      // linter and the console both read.
      expect(result.map((r) => r.name)).toEqual(['Root']);
      expect(strandedNodes(origins, result).map((o) => o.node.name)).toEqual(['Orphan']);
    });

    it('roots at heading 0 when no heading declares itself parentless', () => {
      const nodes: TscnNode[] = [node('Node1', 'NonExistent'), node('Node2', 'NonExistent')];
      const origins = nodes.map((node, i) => ({
        node,
        line: i + 1,
        declaredParent: node.parent,
      }));

      const result = buildSceneTree(nodes);

      // Heading 0 is the root, as in the engine, and every later heading is stranded
      // and named. Returning the flat list as roots would empty the report on the
      // file `packed_scene.cpp:219` refuses.
      expect(result.map((r) => r.name)).toEqual(['Node1']);
      expect(strandedNodes(origins, result).map((o) => o.node.name)).toEqual(['Node2']);
    });

    it('roots at a parentless heading even when it is not heading 0', () => {
      const nodes: TscnNode[] = [node('A', '.'), node('Root')];
      const origins = nodes.map((node, i) => ({
        node,
        line: i + 1,
        declaredParent: node.parent,
      }));

      const result = buildSceneTree(nodes);

      expect(result.map((r) => r.name)).toEqual(['Root']);
      expect(strandedNodes(origins, result)).toEqual([]);
    });
  });

  describe('mixed scenarios', () => {
    it('should handle root with children having parent attribute', () => {
      const nodes: TscnNode[] = [node('Root'), node('Child1', '.'), node('Child2', 'Child1')];

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
          rawProperties: {},
          type: 'Node3D',
          name: 'Root',
          properties: { customProp: 'value' },
          children: [],
        },
        {
          rawProperties: {},
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
        node('Root'),
        {
          rawProperties: {},
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
