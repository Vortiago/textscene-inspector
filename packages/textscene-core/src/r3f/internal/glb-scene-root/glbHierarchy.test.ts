/** `glbSceneRootChildren`: a loaded GLB as tree nodes with stable, disambiguated relative paths. */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import { glbObjectName, glbSceneRootChildren, GLB_ANIMATION_PLAYER_NAME } from './glbHierarchy';
import { tagGodotNodeNames } from '../../../resources/formats/glb/nodeNames';

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
  return displayTypeOf(glbSceneRootChildren(root)[0]!);
}

/** `object` as glTF node 0, which Godot names `godotName`. */
function godotNamed<T extends THREE.Object3D>(object: T, godotName: string): T {
  tagGodotNodeNames(object, new Map([[object, { nodes: 0 }]]), [{ name: godotName, role: 'node' }]);
  return object;
}

describe('glbObjectName', () => {
  it("takes Godot's name for a glTF node", () => {
    expect(glbObjectName(godotNamed(named(new THREE.Mesh(), 'Cube001'), 'Cube_001'))).toBe('Cube_001');
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
    root.add(godotNamed(named(new THREE.Mesh(), 'Cube001'), 'Cube_001'));
    expect(glbSceneRootChildren(root).map((n) => [n.name, relPathOf(n)])).toEqual([['Cube_001', 'Cube_001']]);
  });

  it('walks children in order with nested relative paths', () => {
    const root = new THREE.Group();
    const armature = named(new THREE.Group(), 'Armature');
    armature.add(named(new THREE.Mesh(), 'hand'));
    root.add(named(new THREE.Mesh(), 'body'), named(new THREE.Bone(), 'spine'), armature);

    const nodes = glbSceneRootChildren(root);
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
    expect(glbSceneRootChildren(root).map(relPathOf)).toEqual(['body', 'body@1', 'body@2']);
  });

  it('falls back to the THREE type for an unnamed node', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh());
    const [node] = glbSceneRootChildren(root);
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
    expect(paths(glbSceneRootChildren(root.clone(true)))).toEqual(paths(glbSceneRootChildren(root)));
  });

  it('names each node by its disambiguated path segment, so joining names reproduces the path', () => {
    const root = new THREE.Group();
    const armature = named(new THREE.Group(), 'Armature');
    armature.add(named(new THREE.Mesh(), 'hand'));
    root.add(named(new THREE.Mesh(), 'body'), named(new THREE.Mesh(), 'body'), armature);

    const nodes = glbSceneRootChildren(root);
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

    const nodes = glbSceneRootChildren(root);
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
    const nodes = glbSceneRootChildren(root);
    expect(nodes.map((n) => n.name)).toEqual(['body']);
  });
});
