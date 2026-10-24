/**
 * Tests for Scene Tree Builder
 */

import { describe, it, expect } from 'vitest';
import { orphanedNodes, sceneSeating, seatedParents, seatScene } from './sceneTreeBuilder';
import { node, originsOf, withOrigin } from './testing/seatingKit';
import type { NodeOrigin, TscnNode } from './types';

function build(nodes: TscnNode[]): TscnNode[] {
  return seatScene(originsOf(nodes)).roots;
}

/** The headings `orphanedNodes` reports for a build of `nodes`. */
function orphansOf(nodes: TscnNode[]): NodeOrigin<TscnNode>[] {
  const origins = originsOf(nodes);
  return orphanedNodes(origins, seatScene(origins));
}

describe('seatScene', () => {
  describe('empty and basic cases', () => {
    it('should return empty array for empty input', () => {
      const result = build([]);
      expect(result).toEqual([]);
    });

    it('should handle single root node without children', () => {
      const nodes: TscnNode[] = [node('Root')];

      const result = build(nodes);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Root');
      expect(result[0]!.children).toHaveLength(0);
    });

    it('should handle single root node without parent attribute', () => {
      const nodes: TscnNode[] = [node('Root')];

      const result = build(nodes);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Root');
    });
  });

  describe('parent="." references', () => {
    it('should attach child with parent="." to root node', () => {
      const nodes: TscnNode[] = [node('Root'), node('Child', '.')];

      const result = build(nodes);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Root');
      expect(result[0]!.children).toHaveLength(1);
      expect(result[0]!.children[0]!.name).toBe('Child');
    });

    it('should attach multiple children with parent="." to root', () => {
      const nodes: TscnNode[] = [node('Root'), node('Child1', '.'), node('Child2', '.')];

      const result = build(nodes);

      expect(result).toHaveLength(1);
      expect(result[0]!.children).toHaveLength(2);
      const childNames = result[0]!.children.map((c) => c.name).sort();
      expect(childNames).toEqual(['Child1', 'Child2']);
    });
  });

  describe('named parent references', () => {
    it('should attach child to named parent', () => {
      const nodes: TscnNode[] = [node('Root'), node('Child', '.'), node('GrandChild', 'Child')];

      const result = build(nodes);

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

      const result = build(nodes);

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

      const result = build(nodes);

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

      const [root] = build(nodes);

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

      const [root] = build(nodes);

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

      const [root] = build(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['SplitscreenButton']);
      expect(root!.children[0]!.instanceSubPath).toBe('ColorRect/CenterContainer/VBoxContainer');
    });

    it('re-roots a node when no ancestor on its path is an instance', () => {
      // A malformed authored path, not an instance override: nothing below a plain node is
      // hidden, so Godot re-roots the node.
      const nodes = [node('Level0'), node('Level1', '.'), node('Level3', 'Level2')];

      const [root] = build(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['Level1', 'Level2#Level3']);
    });

    it('does not anchor at a plain node that merely shares the path prefix', () => {
      // `Player` is an ordinary node, not an instance, so everything inside it is
      // visible here and an unresolvable path is a mistake, not an override.
      const nodes = [node('Main'), node('Player', '.'), node('Robot', 'Player/Skeleton')];

      const [root] = build(nodes);

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

      const [root] = build(nodes);

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

      const [root] = build(nodes);

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

      const [root] = build(nodes);

      const player = root!.children[0]!;
      expect(player.name).toBe('Player');
      expect(player.children.map((c) => c.name)).toEqual(['Hat']);
    });

    it('re-roots a %Name whose claim is declared LATER in the file', () => {
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

      const [root] = build(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['_Player#Hat', 'Player']);
      expect(root!.children[1]!.children).toEqual([]);
    });

    it('re-roots a %Name no node in the file claims', () => {
      // Without the flag there is no claim, and Godot warns the parent path has
      // vanished rather than treating `%Player` as an ordinary child name.
      const nodes = [node('Root'), node('Player', '.'), node('Hat', '%Player')];

      const [root] = build(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['Player', '_Player#Hat']);
      expect(root!.children[0]!.children).toEqual([]);
    });

    it('re-roots a parent= naming a node declared LATER in the file', () => {
      // `NODE_FROM_ID` resolves against the tree at heading `i`
      // (`packed_scene.cpp:157-165`), so only headings above are reachable. Probed on
      // 4.7.2: `Body` re-roots as `Later#Body` with a warning, and swapped it seats.
      const nodes = [node('Root'), node('Body', 'Later'), node('Later', '.')];

      const [root] = build(nodes);

      expect(root!.children.map((c) => c.name)).toEqual(['Later#Body', 'Later']);
      expect(root!.children[1]!.children).toEqual([]);
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

      const [root] = build(nodes);

      const inner = root!.children[0]!.children[0]!;
      expect(inner.name).toBe('Inner');
      expect(inner.children[0]!.name).toBe('Deep');
      expect(inner.children[0]!.instanceSubPath).toBe('Body/Mesh');
    });
  });

  describe('error handling', () => {
    it('roots at heading 0 when no heading declares itself parentless', () => {
      const nodes: TscnNode[] = [node('Node1', 'NonExistent'), node('Node2', 'NonExistent')];

      const result = build(nodes);

      // Heading 0 is the root, as in the engine, and the file is one `packed_scene.cpp:219`
      // refuses, so the later heading is stranded and named rather than re-rooted.
      expect(result.map((r) => r.name)).toEqual(['Node1']);
      expect(orphansOf(nodes).map((o) => o.node.name)).toEqual(['Node2']);
    });

    it('roots at a parentless heading even when it is not heading 0', () => {
      const nodes: TscnNode[] = [node('A', '.'), node('Root')];

      const result = build(nodes);

      expect(result.map((r) => r.name)).toEqual(['Root']);
      expect(orphansOf(nodes)).toEqual([]);
    });
  });

  describe('the headings it reads', () => {
    it('builds the same tree twice from one input', () => {
      const origins = originsOf([node('Root'), node('Orphan', 'Gone'), node('Kid', '.')]);

      expect(seatScene(origins).roots).toEqual(seatScene(origins).roots);
    });

    it('leaves the name, children and instance path of every heading node as scanned', () => {
      const nodes = [node('Root'), node('Orphan', 'Gone'), node('Kid', '.')];
      const before = structuredClone(nodes);

      seatScene(originsOf(nodes));

      expect(nodes).toEqual(before);
    });

    it('maps each seated heading to its copy, and an unseated one to nothing', () => {
      const nodes = [node('Root'), node('Kid', '.'), node('Second')];

      const { roots, seated } = seatScene(originsOf(nodes));

      expect(seated.get(nodes[0]!)).toBe(roots[0]);
      expect(seated.get(nodes[1]!)).toBe(roots[0]!.children[0]);
      expect(seated.has(nodes[2]!)).toBe(false);
    });
  });

  describe('a parent path that vanished', () => {
    /** The names of the scene root's children. */
    const rootChildNames = (origins: NodeOrigin<TscnNode>[]) =>
      seatScene(origins).roots[0]!.children.map((child) => child.name);

    it('re-roots the node under the scene root, renamed for the vanished path', () => {
      const nodes = [node('Root'), node('Orphan', 'Gone')];

      const [root] = build(nodes);

      expect(root!.children.map((child) => child.name)).toEqual(['Gone#Orphan']);
      expect(orphansOf(nodes).map((o) => o.node.name)).toEqual(['Orphan']);
    });

    it('keeps the authored parent path and the authored name on the re-rooted node', () => {
      const [root] = build([node('Root'), node('Orphan', 'Gone')]);

      expect(root!.children[0]).toMatchObject({ parent: 'Gone', authoredName: 'Orphan' });
    });

    it.each([
      ['Gone/Deeper', 'Gone_Deeper#Name'],
      ['./Gone', 'Gone#Name'],
      ['/root/Gone', '___root_Gone#Name'],
    ])('spells the rename of %s as %s', (parent, renamed) => {
      expect(rootChildNames(originsOf([node('Root'), node('Name', parent)]))).toEqual([renamed]);
    });

    it('seats the node among the root children at the point of its heading', () => {
      const nodes = [node('Root'), node('First', '.'), node('Orphan', 'Gone'), node('Last', '.')];

      expect(rootChildNames(originsOf(nodes))).toEqual(['First', 'Gone#Orphan', 'Last']);
    });

    it('numbers two orphans that rename alike, as `set_name` does', () => {
      const nodes = [node('Root'), node('A', 'Gone'), node('A', 'Gone')];

      expect(rootChildNames(originsOf(nodes))).toEqual(['Gone#A', 'Gone#A2']);
    });

    it('re-roots a node below an orphan on its own, since the old path no longer exists', () => {
      const nodes = [node('Root'), node('Orphan', 'Gone'), node('Kid', 'Gone/Orphan')];

      const [root] = build(nodes);

      expect(root!.children.map((child) => child.name)).toEqual(['Gone#Orphan', 'Gone_Orphan#Kid']);
      expect(root!.children[0]!.children).toEqual([]);
    });

    it('lets a later heading address the re-rooted node by its new name', () => {
      const nodes = [node('Root'), node('Orphan', 'Gone'), node('Kid', 'Gone#Orphan')];

      const [root] = build(nodes);

      expect(root!.children.map((child) => child.name)).toEqual(['Gone#Orphan']);
      expect(root!.children[0]!.children.map((child) => child.name)).toEqual(['Kid']);
    });

    it('re-roots a node whose parent path climbs out of the tree (edge case)', () => {
      expect(rootChildNames(originsOf([node('Root'), node('Orphan', '../Gone')]))).toEqual([
        '___Gone#Orphan',
      ]);
    });

    it('leaves a node below an instance anchor to the anchor, not the root (edge case)', () => {
      const anchor: TscnNode = { ...node('Inst', '.'), instance: 'ExtResource("1")' };

      const [root] = build([node('Root'), anchor, node('Deep', 'Inst/Body')]);

      expect(root!.children.map((child) => child.name)).toEqual(['Inst']);
      expect(root!.children[0]!.children.map((child) => child.name)).toEqual(['Deep']);
    });

    describe('where Godot refuses the file or follows an id trail', () => {
      it('does not re-root where heading 0 declares a parent', () => {
        const nodes = [node('Root', 'Missing'), node('Orphan', 'Gone')];

        expect(rootChildNames(originsOf(nodes))).toEqual([]);
      });

      it('does not re-root where a later heading declares no parent', () => {
        const nodes = [node('Root'), node('Stray'), node('Orphan', 'Gone')];

        expect(rootChildNames(originsOf(nodes))).toEqual([]);
      });

      it('does not re-root where heading 0 states no type and no instance', () => {
        const root: TscnNode = { ...node('Root'), overridesExistingNode: true };

        expect(rootChildNames(originsOf([root, node('Orphan', 'Gone')]))).toEqual([]);
      });

      it('does not re-root where a heading spells parent="" (edge case)', () => {
        const nodes = [node('Root'), node('Blank'), node('Orphan', 'Gone')];
        const origins = withOrigin(originsOf(nodes), 1, { declaredParent: '' });

        expect(rootChildNames(origins)).toEqual([]);
      });

      it('does not re-root a heading whose parent_id_path Godot follows to a node (edge case)', () => {
        const nodes = [node('Root'), node('Mid', '.'), node('Orphan', 'Gone')];
        const origins = withOrigin(originsOf(nodes, { Mid: 7 }), 2, { idTrail: [7] });

        expect(rootChildNames(origins)).toEqual(['Mid']);
      });

      it('re-roots a heading whose parent_id_path names no heading, as Godot does (edge case)', () => {
        const nodes = [node('Root'), node('Orphan', 'Gone')];
        const origins = withOrigin(originsOf(nodes), 1, { idTrail: [7] });

        expect(rootChildNames(origins)).toEqual(['Gone#Orphan']);
      });

      it('re-roots a heading whose trail names a heading that was itself re-rooted (edge case)', () => {
        // The named node does not exist at its authored path, so the trail finds nothing.
        const nodes = [node('Root'), node('Lost', 'Gone'), node('Orphan', 'Gone2')];
        const origins = withOrigin(originsOf(nodes, { Lost: 7 }), 2, { idTrail: [7] });

        expect(rootChildNames(origins)).toEqual(['Gone#Lost', 'Gone2#Orphan']);
      });
    });
  });

  describe('mixed scenarios', () => {
    it('should handle root with children having parent attribute', () => {
      const nodes: TscnNode[] = [node('Root'), node('Child1', '.'), node('Child2', 'Child1')];

      const result = build(nodes);

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

      const result = build(nodes);

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

      const result = build(nodes);

      expect(result[0]!.type).toBe('Node3D');
      expect(result[0]!.children[0]!.type).toBe('MeshInstance3D');
    });
  });
});

describe('seatScene: index=', () => {
  const root = node('Root');

  it('moves a node to the index it states among its parent children (packed_scene.cpp:543-544)', () => {
    const [seated] = build([root, node('A', '.'), node('B', '.'), { ...node('C', '.'), index: 0 }]);

    expect(seated!.children.map((c) => c.name)).toEqual(['C', 'A', 'B']);
  });

  it('keeps a node in the order of its heading when it states no index', () => {
    const [seated] = build([root, node('A', '.'), node('B', '.')]);

    expect(seated!.children.map((c) => c.name)).toEqual(['A', 'B']);
  });

  it('moves a re-rooted node to its index among the root children', () => {
    const [seated] = build([root, node('A', '.'), node('B', '.'), { ...node('C', 'Missing'), index: 0 }]);

    expect(seated!.children.map((c) => c.name)).toEqual(['Missing#C', 'A', 'B']);
  });

  it('leaves the index to the instanced scene when the parent instances one', () => {
    const body = { ...node('Body', '.'), instance: 'ExtResource("1")' };
    const [seated] = build([root, body, node('A', 'Body'), { ...node('B', 'Body'), index: 0 }]);

    expect(seated!.children[0]!.children.map((c) => c.name)).toEqual(['A', 'B']);
  });
});

describe('seatScene resolve', () => {
  const claiming = (name: string, parent: string, fields: Partial<TscnNode> = {}): TscnNode => ({
    ...node(name, parent),
    rawProperties: { unique_name_in_owner: 'true' },
    ...fields,
  });
  const instance = (name: string, parent?: string): TscnNode => ({
    ...node(name, parent),
    instance: 'ExtResource("1")',
  });
  const seat = (nodes: TscnNode[]) => seatScene(originsOf(nodes));
  const foundName = (nodes: TscnNode[], path: string): string | undefined => {
    const resolution = seat(nodes).resolve(path);
    return resolution.status === 'found' ? resolution.node.name : undefined;
  };
  const statusOf = (nodes: TscnNode[], path: string): string => seat(nodes).resolve(path).status;

  it('finds a node of a plain scene by its path, and the root by .', () => {
    const nodes = [node('Root'), node('A', '.'), node('B', 'A')];

    expect(foundName(nodes, 'A/B')).toBe('B');
    expect(foundName(nodes, '.')).toBe('Root');
  });

  it('finds a node seated under a path into an instance', () => {
    const nodes = [node('Root'), instance('Inst', '.'), node('X', 'Inst/Sub'), node('Y', 'Inst/Sub/X')];

    expect(foundName(nodes, 'Inst/Sub/X')).toBe('X');
    expect(foundName(nodes, 'Inst/Sub/X/Y')).toBe('Y');
  });

  it('cannot say what a path into an instance names when no heading is seated there', () => {
    expect(statusOf([node('Root'), instance('Inst', '.')], 'Inst/Sub')).toBe('unknowable');
  });

  it('finds a node seated under a %Name parent at its canonical path', () => {
    const nodes = [node('Root'), claiming('Player', '.'), node('Hand', '%Player')];

    expect(foundName(nodes, 'Player/Hand')).toBe('Hand');
    expect(foundName(nodes, '%Player/Hand')).toBe('Hand');
  });

  it('finds a node seated under a ./A parent at A', () => {
    const nodes = [node('Root'), node('A', '.'), node('B', './A')];

    expect(foundName(nodes, 'A/B')).toBe('B');
  });

  it('finds the later of two siblings that share a name, as the child table keeps it', () => {
    // `_add_child_nocheck` inserts into `data.children` by name (node.cpp:1656), so the later wins.
    const nodes = [node('Root'), node('A', '.'), { ...node('A', '.'), type: 'Node2D' }];

    const resolution = seat(nodes).resolve('A');

    expect(resolution.status === 'found' && resolution.node.type).toBe('Node2D');
  });

  it('finds a re-rooted heading by its rename only, and nothing at its vanished path', () => {
    const nodes = [node('Root'), node('Loose', 'Gone'), node('Child', 'Gone/Loose')];

    expect(foundName(nodes, 'Gone#Loose')).toBe('Gone#Loose');
    expect(statusOf(nodes, 'Gone/Loose')).toBe('missing');
    expect(statusOf(nodes, 'Loose')).toBe('missing');
  });

  it('finds nothing above the root, nor at an absolute path', () => {
    // The walk runs from the root at instantiate, off the tree (packed_scene.cpp:161): `..` there has
    // no parent (node.cpp:1920-1921), and an absolute path is refused (node.cpp:1898).
    const nodes = [node('Root'), node('A', '.')];

    expect(statusOf(nodes, '..')).toBe('missing');
    expect(statusOf(nodes, '/root/Root/A')).toBe('missing');
  });

  it('finds no %Name that nothing claims', () => {
    expect(statusOf([node('Root'), node('Player', '.')], '%Player')).toBe('missing');
  });

  it('cannot say what an unclaimed %Name names below an instanced root', () => {
    // The root's own table holds the base scene's claims (node.cpp:1930-1933).
    expect(statusOf([instance('Root'), node('Player', '.')], '%Player')).toBe('unknowable');
  });

  it('cannot say what an unclaimed %Name names from an instance', () => {
    expect(statusOf([node('Root'), instance('Inst', '.')], 'Inst/%Part')).toBe('unknowable');
  });

  it('cannot say what a %Name names from an instance, though the root holds a claim', () => {
    // The instance reads its own table first (node.cpp:1930-1933), which its sub-scene fills.
    expect(statusOf([node('Root'), claiming('Part', '.'), instance('Inst', '.')], 'Inst/%Part')).toBe(
      'unknowable'
    );
  });

  it('cannot say what a %Name names from a node another owner holds, whose table its sub-scene fills', () => {
    // The saver writes `owner=` only for an owner other than the root (resource_format_text.cpp:2024-2025).
    const added = { ...node('Added', 'Inst/Sub'), type: 'Node', owner: 'Inst' };
    const nodes = [node('Root'), claiming('Part', '.'), instance('Inst', '.'), added];

    expect(statusOf(nodes, 'Inst/Sub/Added/%Part')).toBe('unknowable');
  });

  it('seats a heading whose parent= reads a %Name an inherited base claims under the root, keeping the rest', () => {
    // The base scene fills the root's table (node.cpp:1930-1933), and the graft resolves the rest there.
    const nodes = [instance('Root'), node('Hat', '%BaseClaim')];
    const origins = originsOf(nodes);
    const [root] = seatScene(origins).roots;

    expect(root!.children.map(({ name, instanceSubPath }) => [name, instanceSubPath])).toEqual([
      ['Hat', '%BaseClaim'],
    ]);
    expect(orphanedNodes(origins, seatScene(origins))).toEqual([]);
  });

  it('seats a heading whose parent= reads a %Name inside an instance under that instance, keeping the rest', () => {
    const nodes = [node('Root'), instance('Inst', '.'), node('Hat', 'Inst/Sub/%Part/Deep')];
    const inst = seatScene(originsOf(nodes)).roots[0]!.children[0]!;

    expect(inst.children.map(({ name, instanceSubPath }) => [name, instanceSubPath])).toEqual([
      ['Hat', 'Sub/%Part/Deep'],
    ]);
  });

  it('leaves an override claim under an instance out of the root table', () => {
    // An override heading keeps the sub-scene's owner (resource_format_text.cpp:264-265), so its
    // `%Name` lands in that owner's table (node.cpp:2222-2233), not the root's.
    const nodes = [
      node('Root'),
      instance('Inst', '.'),
      claiming('Part', 'Inst', { type: 'Node', overridesExistingNode: true }),
      node('Hat', '%Part'),
    ];

    const part = seat(nodes).roots[0]!.children[0]!.children[0]!;

    expect(statusOf(nodes, '%Part')).toBe('missing');
    expect(part.children).toEqual([]);
  });
});

describe('seatScene headings landed by a parent_id_path', () => {
  /** A root, `Mid` (id 7), `Orphan` whose `parent=` vanishes and whose trail lands on `Mid`, and `Child` below `Orphan`. */
  const nodes = [node('Root'), node('Mid', '.'), node('Orphan', 'Gone'), node('Child', 'Mid/Orphan')];
  const landing = () => withOrigin(originsOf(nodes, { Mid: 7 }), 2, { idTrail: [7] });
  const names = (parent: TscnNode | undefined) => parent?.children.map((child) => child.name);

  it('seats the heading under the heading its trail names, keeping its name', () => {
    const { seated } = seatScene(landing());

    expect(names(seated.get(nodes[1]!))).toEqual(['Orphan']);
  });

  it('addresses the landed heading at the path it lives at, so a child below it seats', () => {
    const { seated, resolve } = seatScene(landing());

    expect(names(seated.get(nodes[2]!))).toEqual(['Child']);
    expect(resolve('Mid/Orphan')).toEqual({ status: 'found', node: seated.get(nodes[2]!) });
  });

  it('counts the landed heading as an orphan, since it is not at the path it declares', () => {
    const origins = landing();

    expect(orphanedNodes(origins, seatScene(origins)).map(({ node: heading }) => heading.name)).toEqual([
      'Orphan',
    ]);
  });

  it('re-roots a heading whose trail names a landed heading, which is not at its own path', () => {
    const chained = [...nodes.slice(0, 3), node('Second', 'Gone2')];
    const origins = withOrigin(originsOf(chained, { Mid: 7, Orphan: 8 }), 2, { idTrail: [7] });
    const { roots } = seatScene(withOrigin(origins, 3, { idTrail: [8] }));

    expect(names(roots[0])).toEqual(['Mid', 'Gone2#Second']);
  });

  it('seats nothing where the scene is refused, since Godot instantiates none of it', () => {
    const refused = [...nodes.slice(0, 3), node('Stray')];
    const origins = withOrigin(withOrigin(originsOf(refused), 1, { uniqueId: 7 }), 2, { idTrail: [7] });

    expect(seatScene(origins).seated.has(refused[2]!)).toBe(false);
  });
});

describe('seatedParents', () => {
  const parentNames = (nodes: TscnNode[], origins = originsOf(nodes)) => {
    const { roots, seated } = seatScene(origins);
    const parents = seatedParents(roots);
    return nodes.map((heading) => parents.get(seated.get(heading)!)?.name);
  };

  it('names the node each heading sits under', () => {
    const nodes = [node('Root'), node('A', '.'), node('B', 'A')];

    expect(parentNames(nodes)).toEqual([undefined, 'Root', 'A']);
  });

  it('names no parent for a re-rooted heading, whose parent= vanished', () => {
    const nodes = [node('Root'), node('Lost', 'Gone')];

    expect(parentNames(nodes)).toEqual([undefined, undefined]);
  });

  it('names no parent for a heading whose parent= names a later heading', () => {
    const nodes = [node('Root'), node('Early', 'Later'), node('Later', '.')];

    expect(parentNames(nodes)).toEqual([undefined, undefined, 'Root']);
  });

  it('names no heading for a path into an instance, which names content this file does not list', () => {
    const nodes = [
      node('Root'),
      { ...node('Inst', '.'), instance: 'ExtResource("1")' },
      node('X', 'Inst/Sub'),
    ];

    expect(parentNames(nodes)).toEqual([undefined, 'Root', undefined]);
  });

  it('names the heading a trail landed the node on', () => {
    const nodes = [node('Root'), node('Mid', '.'), node('Orphan', 'Gone')];
    const origins = withOrigin(originsOf(nodes, { Mid: 7 }), 2, { idTrail: [7] });

    expect(parentNames(nodes, origins)).toEqual([undefined, 'Root', 'Mid']);
  });
});

describe('sceneSeating', () => {
  it('reads the seating seatScene built for its roots, claims in declaration order included', () => {
    const claiming = (name: string, parent: string): TscnNode => ({
      ...node(name, parent),
      rawProperties: { unique_name_in_owner: 'true' },
    });
    const nodes = [node('Root'), node('P', '.'), node('Q', '.'), claiming('X', 'Q'), claiming('X', 'P')];
    const { roots, seated } = seatScene(originsOf(nodes));

    const resolution = sceneSeating(roots).resolve('%X');

    expect(resolution.status === 'found' && resolution.node).toBe(seated.get(nodes[3]!));
  });

  it('finds nothing in a scene with no node', () => {
    expect(sceneSeating(seatScene([]).roots).resolve('.').status).toBe('missing');
  });

  it('refuses roots that seatScene did not return', () => {
    expect(() => sceneSeating([node('Root')])).toThrow('expected roots that seatScene returned');
  });
});

describe('seatScene pathOf', () => {
  it('gives each seated node its root-relative path, the root at the empty path', () => {
    const seating = seatScene(originsOf([node('Root'), node('Body', './'), node('Arm', './Body')]));
    expect([...seating.pathOf.values()]).toEqual(['', 'Body', 'Body/Arm']);
  });

  it('gives both of two siblings sharing a name their path', () => {
    const [root, first, second] = [node('Root'), node('A', '.'), node('A', '.')];
    const { seated, pathOf } = seatScene(originsOf([root, first, second]));
    expect([pathOf.get(seated.get(first)!), pathOf.get(seated.get(second)!)]).toEqual(['A', 'A']);
  });

  it('gives a re-rooted node its rename', () => {
    const lost = node('Lost', 'Gone');
    const { seated, pathOf } = seatScene(originsOf([node('Root'), lost]));
    expect(pathOf.get(seated.get(lost)!)).toBe('Gone#Lost');
  });

  it('gives no path in a file with no node', () => {
    expect(seatScene([]).pathOf.size).toBe(0);
  });
});
