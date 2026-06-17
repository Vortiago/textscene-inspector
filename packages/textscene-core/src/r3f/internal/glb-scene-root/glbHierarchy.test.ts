/**
 * buildGlbHierarchy — deterministic walk of a loaded GLB Object3D into a
 * display hierarchy with stable, disambiguated relative paths.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildGlbHierarchy,
  glbDisplayType,
  glbHierarchyToTscnNodes,
  glbSceneRootChildren,
  GLB_ANIMATION_PLAYER_NAME,
  GLB_ANIMATION_PLAYER_TYPE,
} from './glbHierarchy';

function named<T extends THREE.Object3D>(obj: T, name: string): T {
  obj.name = name;
  return obj;
}

describe('buildGlbHierarchy', () => {
  it('walks children in order with nested relative paths', () => {
    const root = new THREE.Group();
    const armature = named(new THREE.Group(), 'Armature');
    armature.add(named(new THREE.Mesh(), 'hand'));
    root.add(named(new THREE.Mesh(), 'body'), named(new THREE.Bone(), 'spine'), armature);

    const h = buildGlbHierarchy(root);
    expect(h.map((n) => n.relPath)).toEqual(['body', 'spine', 'Armature']);
    expect(h[2]!.children[0]!.relPath).toBe('Armature/hand');
  });

  it('disambiguates duplicate sibling names with @n', () => {
    const root = new THREE.Group();
    root.add(named(new THREE.Mesh(), 'body'), named(new THREE.Mesh(), 'body'), named(new THREE.Mesh(), 'body'));
    expect(buildGlbHierarchy(root).map((n) => n.relPath)).toEqual(['body', 'body@1', 'body@2']);
  });

  it('falls back to the THREE type for unnamed nodes', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh()); // name = ''
    const h = buildGlbHierarchy(root);
    expect(h[0]!.name).toBe('Mesh');
    expect(h[0]!.relPath).toBe('Mesh');
  });

  it('maps THREE types to Godot-ish display types', () => {
    expect(glbDisplayType('Mesh')).toBe('Mesh');
    expect(glbDisplayType('SkinnedMesh')).toBe('Mesh');
    expect(glbDisplayType('Bone')).toBe('Bone');
    expect(glbDisplayType('Group')).toBe('Node3D');
    expect(glbDisplayType('PerspectiveCamera')).toBe('Camera3D');
    expect(glbDisplayType('PointLight')).toBe('Light');
  });

  it('produces identical paths for a structurally-equal clone', () => {
    const root = new THREE.Group();
    const g = named(new THREE.Group(), 'g');
    g.add(named(new THREE.Mesh(), 'm'), named(new THREE.Mesh(), 'm'));
    root.add(g);
    const a = buildGlbHierarchy(root);
    const b = buildGlbHierarchy(root.clone(true));
    const paths = (nodes: ReturnType<typeof buildGlbHierarchy>): string[] =>
      nodes.flatMap((n) => [n.relPath, ...paths(n.children)]);
    expect(paths(a)).toEqual(paths(b));
  });
});

describe('glbHierarchyToTscnNodes', () => {
  it('converts to synthetic TscnNodes whose names are the disambiguated path segments', () => {
    const root = new THREE.Group();
    const armature = named(new THREE.Group(), 'Armature');
    armature.add(named(new THREE.Mesh(), 'hand'));
    root.add(named(new THREE.Mesh(), 'body'), named(new THREE.Mesh(), 'body'), armature);

    const nodes = glbHierarchyToTscnNodes(buildGlbHierarchy(root));
    expect(nodes.map((n) => n.name)).toEqual(['body', 'body@1', 'Armature']);
    expect(nodes.map((n) => n.type)).toEqual(['GLBMesh', 'GLBMesh', 'GLBNode']);
    // Names are the relPath segments → the tree's joinPath() reproduces relPath.
    expect(nodes[2]!.children[0]!.name).toBe('hand');
    expect((nodes[2]!.children[0]!.properties as Record<string, unknown>).glbRelPath).toBe('Armature/hand');
  });
});

describe('glbSceneRootChildren', () => {
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
    expect(ap.type).toBe(GLB_ANIMATION_PLAYER_TYPE);
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
