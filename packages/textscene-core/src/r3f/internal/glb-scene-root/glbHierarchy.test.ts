/** `glbSceneRootChildren`: a loaded GLB as tree nodes with stable, disambiguated relative paths. */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeNode } from '../../../parser/testing/parserKit';
import '../../../nodes/node/index';
import type { TscnNode } from '../../../parser/types';
import {
  flattenGlbObjects,
  glbObjectName,
  glbChildrenBelow,
  glbHostChildrenInOrder,
  glbSceneRootChildren,
  glbSubtreeEnd,
  GLB_ANIMATION_PLAYER_NAME,
} from './glbHierarchy';
import { tagAsLoadedGlb } from '../../../resources/formats/glb/testing/loadedGlbTags';

function named<T extends THREE.Object3D>(obj: T, name: string): T {
  obj.name = name;
  return obj;
}

function relPathOf(node: TscnNode): unknown {
  return (node.properties as Record<string, unknown>).glbRelPath;
}

function displayTypeOf(node: TscnNode): unknown {
  return (node.properties as Record<string, unknown>).glbDisplayType;
}

/** The display type the tree gives a lone child object of `object`'s THREE type. */
function displayTypeFor(object: THREE.Object3D): unknown {
  const root = new THREE.Group();
  root.add(object);
  return displayTypeOf(glbSceneRootChildren(root, [])[0]!);
}

/** `object` as a glTF node named `gltfName`, which Godot spells otherwise. */
function godotNamed<T extends THREE.Object3D>(object: T, gltfName: string): T {
  const scene = new THREE.Group();
  scene.add(object);
  tagAsLoadedGlb(scene, { gltfNames: { [object.name]: gltfName } });
  scene.remove(object);
  return object;
}

describe('glbObjectName', () => {
  it("takes Godot's name for a glTF node", () => {
    expect(glbObjectName(godotNamed(named(new THREE.Mesh(), 'Cube001'), 'Cube.001'))).toBe('Cube_001');
  });

  it("takes three's name for an object no node names", () => {
    expect(glbObjectName(named(new THREE.Bone(), 'Hip'))).toBe('Hip');
  });

  it('takes the type for an unnamed object', () => {
    expect(glbObjectName(new THREE.Mesh())).toBe('Mesh');
  });
});

describe('glbSceneRootChildren paths', () => {
  it("paths each node by Godot's name", () => {
    const root = new THREE.Group();
    root.add(godotNamed(named(new THREE.Mesh(), 'Cube001'), 'Cube.001'));
    expect(glbSceneRootChildren(root, []).map((n) => [n.name, relPathOf(n)])).toEqual([
      ['Cube_001', 'Cube_001'],
    ]);
  });

  it('walks children in order with nested relative paths', () => {
    const root = new THREE.Group();
    const armature = named(new THREE.Group(), 'Armature');
    armature.add(named(new THREE.Mesh(), 'hand'));
    root.add(named(new THREE.Mesh(), 'body'), named(new THREE.Bone(), 'spine'), armature);

    const nodes = glbSceneRootChildren(root, []);
    expect(nodes.map(relPathOf)).toEqual(['body', 'spine', 'Armature']);
    expect(relPathOf(nodes[2]!.children[0]!)).toBe('Armature/hand');
  });

  it('disambiguates duplicate sibling names with @n', () => {
    const root = new THREE.Group();
    root.add(
      named(new THREE.Mesh(), 'body'),
      named(new THREE.Mesh(), 'body'),
      named(new THREE.Mesh(), 'body')
    );
    expect(glbSceneRootChildren(root, []).map(relPathOf)).toEqual(['body', 'body@1', 'body@2']);
  });

  it('falls back to the THREE type for an unnamed node', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh());
    const [node] = glbSceneRootChildren(root, []);
    expect(node!.name).toBe('Mesh');
    expect(relPathOf(node!)).toBe('Mesh');
  });

  it('produces identical paths for a structurally equal clone', () => {
    const root = new THREE.Group();
    const g = named(new THREE.Group(), 'g');
    g.add(named(new THREE.Mesh(), 'm'), named(new THREE.Mesh(), 'm'));
    root.add(g);
    const paths = (nodes: readonly TscnNode[]): unknown[] =>
      nodes.flatMap((n) => [relPathOf(n), ...paths(n.children)]);
    expect(paths(glbSceneRootChildren(root.clone(true), []))).toEqual(paths(glbSceneRootChildren(root, [])));
  });

  it('names each node by its disambiguated path segment, so joining names reproduces the path', () => {
    const root = new THREE.Group();
    const armature = named(new THREE.Group(), 'Armature');
    armature.add(named(new THREE.Mesh(), 'hand'));
    root.add(named(new THREE.Mesh(), 'body'), named(new THREE.Mesh(), 'body'), armature);

    const nodes = glbSceneRootChildren(root, []);
    expect(nodes.map((n) => n.name)).toEqual(['body', 'body@1', 'Armature']);
    expect(nodes.map((n) => n.type)).toEqual(['GLBMesh', 'GLBMesh', 'GLBNode']);
    expect(nodes[2]!.children[0]!.name).toBe('hand');
    expect(relPathOf(nodes[2]!.children[0]!)).toBe('Armature/hand');
  });
});

describe('glbSceneRootChildren display types', () => {
  it.each([
    ['Mesh', () => new THREE.Mesh(), 'Mesh'],
    ['SkinnedMesh', () => new THREE.SkinnedMesh(), 'Mesh'],
    // An instanced glTF node loads as an InstancedMesh under `three-loader`.
    ['InstancedMesh', () => new THREE.InstancedMesh(new THREE.BufferGeometry(), undefined, 1), 'Mesh'],
    ['Bone', () => new THREE.Bone(), 'Bone'],
    ['Group', () => new THREE.Group(), 'Node3D'],
    ['Object3D', () => new THREE.Object3D(), 'Node3D'],
    ['PerspectiveCamera', () => new THREE.PerspectiveCamera(), 'Camera3D'],
    ['PointLight', () => new THREE.PointLight(), 'Light'],
  ])('shows a %s as a %s', (_type, make, expected) => {
    expect(displayTypeFor(make())).toBe(expected);
  });

  it('keeps the THREE type of an object with no Godot counterpart', () => {
    expect(displayTypeFor(new THREE.LineSegments())).toBe('LineSegments');
  });
});

describe('glbSceneRootChildren animation player', () => {
  it('appends an AnimationPlayer node when the GLB carries clips (Godot parity)', () => {
    const root = new THREE.Group();
    root.add(named(new THREE.Mesh(), 'body'));
    (root as THREE.Object3D & { animations: THREE.AnimationClip[] }).animations = [
      new THREE.AnimationClip('idle', 1, []),
      new THREE.AnimationClip('run', 1, []),
    ];

    const nodes = glbSceneRootChildren(root, []);
    expect(nodes.map((n) => n.name)).toEqual(['body', GLB_ANIMATION_PLAYER_NAME]);
    const ap = nodes.at(-1)!;
    // `GLB`-prefixed, so `rendersOwnVisual` reports it as drawing.
    expect(ap.type).toBe('GLBAnimationPlayer');
    expect(ap.children).toEqual([]);
    expect((ap.properties as Record<string, unknown>).glbClipNames).toEqual(['idle', 'run']);
  });

  it('omits the AnimationPlayer node when the GLB has no clips', () => {
    const root = new THREE.Group();
    root.add(named(new THREE.Mesh(), 'body'));
    const nodes = glbSceneRootChildren(root, []);
    expect(nodes.map((n) => n.name)).toEqual(['body']);
  });
});

describe('glbSceneRootChildren host children', () => {
  /** A GLB root with the objects `a` and `b` and one clip, so an AnimationPlayer follows them. */
  function rigWithClip(): THREE.Group {
    const root = new THREE.Group();
    root.add(named(new THREE.Group(), 'a'), named(new THREE.Group(), 'b'));
    root.animations = [new THREE.AnimationClip('idle', 1, [])];
    return root;
  }

  const namesOf = (nodes: readonly TscnNode[]) => nodes.map((node) => node.name);

  it('puts a host child with no index after the objects and the AnimationPlayer', () => {
    const host = makeNode('Host', 'Node');

    expect(namesOf(glbSceneRootChildren(rigWithClip(), [], [host]))).toEqual([
      'a',
      'b',
      GLB_ANIMATION_PLAYER_NAME,
      'Host',
    ]);
  });

  it('moves a host child to its index among the objects', () => {
    const host = { ...makeNode('Host', 'Node'), index: 1 };

    expect(namesOf(glbSceneRootChildren(rigWithClip(), [], [host]))).toEqual([
      'a',
      'Host',
      'b',
      GLB_ANIMATION_PLAYER_NAME,
    ]);
  });

  it('adds the host children in turn, the way the loader does', () => {
    const first = makeNode('First', 'Node');
    const second = { ...makeNode('Second', 'Node'), index: 0 };

    expect(namesOf(glbSceneRootChildren(rigWithClip(), [], [first, second]))).toEqual([
      'Second',
      'a',
      'b',
      GLB_ANIMATION_PLAYER_NAME,
      'First',
    ]);
  });

  it('keeps a host child whose index is past the last place at the end (edge case)', () => {
    const host = { ...makeNode('Host', 'Node'), index: 9 };

    expect(namesOf(glbSceneRootChildren(rigWithClip(), [], [host])).at(-1)).toBe('Host');
  });

  it('leaves the shared children without the host child for one call', () => {
    const root = rigWithClip();

    glbSceneRootChildren(root, [], [makeNode('Host', 'Node')]);

    expect(namesOf(glbSceneRootChildren(root, []))).toEqual(['a', 'b', GLB_ANIMATION_PLAYER_NAME]);
  });
});

describe('glbHostChildrenInOrder', () => {
  it('lists the host children in the order they stand among the objects', () => {
    const root = new THREE.Group();
    root.add(named(new THREE.Group(), 'a'), named(new THREE.Group(), 'b'));
    const first = makeNode('First', 'Node');
    const second = { ...makeNode('Second', 'Node'), index: 0 };

    expect(glbHostChildrenInOrder(root, [first, second])).toEqual([second, first]);
  });
});

describe('glbChildrenBelow', () => {
  /** A GLB whose object `body` holds `arm` and `leg`. */
  function rig() {
    const root = new THREE.Group();
    const body = named(new THREE.Group(), 'body');
    body.add(named(new THREE.Group(), 'arm'), named(new THREE.Group(), 'leg'));
    root.add(body);
    return flattenGlbObjects(root);
  }

  const BODY = 0;
  const ARM = 1;
  const LEG = 2;

  it('lists a node with no index after the objects of its target', () => {
    const node = makeNode('Node', 'Node');

    expect(glbChildrenBelow(rig(), [{ node, target: BODY }]).get(BODY)).toEqual([
      { entry: ARM },
      { entry: LEG },
      node,
    ]);
  });

  it('moves a node to its index among the objects of its target', () => {
    const node = { ...makeNode('Node', 'Node'), index: 1 };

    expect(glbChildrenBelow(rig(), [{ node, target: BODY }]).get(BODY)).toEqual([
      { entry: ARM },
      node,
      { entry: LEG },
    ]);
  });

  it('adds the nodes of one target in authored order', () => {
    const first = makeNode('First', 'Node');
    const second = { ...makeNode('Second', 'Node'), index: 0 };

    expect(
      glbChildrenBelow(rig(), [
        { node: first, target: BODY },
        { node: second, target: BODY },
      ]).get(BODY)
    ).toEqual([second, { entry: ARM }, { entry: LEG }, first]);
  });

  it('lists only the targets that gain a node', () => {
    const node = makeNode('Node', 'Node');

    expect([...glbChildrenBelow(rig(), [{ node, target: LEG }]).keys()]).toEqual([LEG]);
  });
});

describe('glbSceneRootChildren per GLB', () => {
  function rootWithBody(): THREE.Group {
    const root = new THREE.Group();
    root.add(named(new THREE.Mesh(), 'body'));
    return root;
  }

  it('builds the children of one GLB once', () => {
    const root = rootWithBody();
    expect(glbSceneRootChildren(root, [])).toBe(glbSceneRootChildren(root, []));
  });

  it('refuses a write to the children it shares', () => {
    const children = glbSceneRootChildren(rootWithBody(), []);
    expect(() => children.push(children[0]!)).toThrow(TypeError);
    expect(() => children[0]!.children.push(children[0]!)).toThrow(TypeError);
  });

  it('builds its own children for each of two GLBs', () => {
    expect(glbSceneRootChildren(rootWithBody(), [])).not.toBe(glbSceneRootChildren(rootWithBody(), []));
  });

  it('leaves the shared children without a node attached for one call', () => {
    const root = rootWithBody();
    const marker = { ...makeNode('Marker', 'Node'), glbTargetRelPath: 'body' };

    expect(glbSceneRootChildren(root, [marker])[0]!.children).toHaveLength(1);
    expect(glbSceneRootChildren(root, [])[0]!.children).toHaveLength(0);
  });
});

describe('flattenGlbObjects', () => {
  it('lists a node, then everything below it, before its next sibling', () => {
    // `glbSubtreeEnd` finds the end of a node's subtree by scanning on from it.
    const root = new THREE.Group();
    const first = named(new THREE.Group(), 'first');
    first.add(named(new THREE.Group(), 'inner'));
    root.add(first, named(new THREE.Group(), 'second'));

    expect(flattenGlbObjects(root).map((entry) => entry.relPath)).toEqual(['first', 'first/inner', 'second']);
  });
});

describe('glbSubtreeEnd', () => {
  /** The entries of `first` (holding `inner`, which holds `deep`), then `second`. */
  function nestedEntries() {
    const root = new THREE.Group();
    const first = named(new THREE.Group(), 'first');
    const inner = named(new THREE.Group(), 'inner');
    inner.add(named(new THREE.Group(), 'deep'));
    first.add(inner);
    root.add(first, named(new THREE.Group(), 'second'));
    return flattenGlbObjects(root);
  }

  it('ends a subtree at the next entry outside it', () => {
    expect(glbSubtreeEnd(nestedEntries(), 0)).toBe(3);
  });

  it('ends a nested subtree where its parent ends too', () => {
    expect(glbSubtreeEnd(nestedEntries(), 1)).toBe(3);
  });

  it('ends a leaf just after it', () => {
    expect(glbSubtreeEnd(nestedEntries(), 3)).toBe(4);
  });
});

describe('one walk per GLB', () => {
  /** A GLB whose root counts each read of its children, which every walk of it starts with. */
  function countedRoot(): { root: THREE.Group; walks: () => number } {
    const root = new THREE.Group();
    root.add(named(new THREE.Mesh(), 'body'));
    const children = root.children;
    let reads = 0;
    Object.defineProperty(root, 'children', {
      get: () => {
        reads++;
        return children;
      },
    });
    return { root, walks: () => reads };
  }

  it('walks a GLB once for its objects and for each build of its children', () => {
    const { root, walks } = countedRoot();
    flattenGlbObjects(root);
    const readsOfOneWalk = walks();
    const marker = { ...makeNode('Marker', 'Node'), glbTargetRelPath: 'body' };

    flattenGlbObjects(root);
    glbSceneRootChildren(root, [marker]);
    glbSceneRootChildren(root, [marker]);
    glbSceneRootChildren(root, []);

    expect(walks()).toBe(readsOfOneWalk);
  });

  it('walks each of two GLBs once (edge case)', () => {
    const first = countedRoot();
    const second = countedRoot();
    flattenGlbObjects(first.root);
    flattenGlbObjects(second.root);
    expect(first.walks()).toBeGreaterThan(0);
    expect(second.walks()).toBe(first.walks());
  });
});
