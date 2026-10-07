/**
 * Cyclic instancing in the live scene tree: a scene that instances itself, directly
 * or through another scene, stops at the instance whose scene is already above it.
 * Godot refuses such a scene, so the walk must end rather than expand it.
 */
import { describe, expect, it } from 'vitest';
import {
  collapseLiveNode,
  collectLiveNodes,
  liveChildGroups,
  resolveLiveNode,
  type CachedSceneSource,
  type LiveTreeContext,
  type SceneScope,
} from './liveSceneTree';
import type { TscnExternalResource, TscnNode, TscnScene } from '../parser/types';

function makeNode(name: string, type: string, extras: Partial<TscnNode> = {}): TscnNode {
  return { name, type, children: [], properties: {}, ...extras };
}

function ext(id: string, path: string): TscnExternalResource {
  return { id, path, type: 'PackedScene' };
}

function cacheOf(entries: Record<string, TscnScene>): CachedSceneSource {
  return { getCached: (p) => entries[p] };
}

function allPaths(roots: readonly TscnNode[], ctx: LiveTreeContext): string[] {
  return collectLiveNodes(roots, ctx, () => true).map((entry) => entry.path);
}

/** `res://a.tscn`: a root with two children that each instance `res://a.tscn`. */
const SELF_EXT = [ext('1', 'res://a.tscn')];
const SELF_ROOTS = [
  makeNode('Root', 'Node3D', {
    children: [
      makeNode('A', 'Node3D', { instance: 'ExtResource("1")' }),
      makeNode('B', 'Node3D', { instance: 'ExtResource("1")' }),
    ],
  }),
];
const SELF_SCENE: TscnScene = { nodes: SELF_ROOTS, externalResources: SELF_EXT, internalResources: [] };
const SELF_CTX: LiveTreeContext = {
  externalResources: SELF_EXT,
  internalResources: [],
  sceneCache: cacheOf({ 'res://a.tscn': SELF_SCENE }),
};

/** `res://a.tscn` instances `res://b.tscn`, which instances `res://a.tscn`. */
const A_EXT = [ext('1', 'res://b.tscn')];
const B_SCENE: TscnScene = {
  nodes: [
    makeNode('BRoot', 'Node3D', { children: [makeNode('ToA', 'Node3D', { instance: 'ExtResource("2")' })] }),
  ],
  externalResources: [ext('2', 'res://a.tscn')],
  internalResources: [],
};
const A_ROOTS = [
  makeNode('ARoot', 'Node3D', { children: [makeNode('ToB', 'Node3D', { instance: 'ExtResource("1")' })] }),
];
const A_SCENE: TscnScene = { nodes: A_ROOTS, externalResources: A_EXT, internalResources: [] };
const INDIRECT_CTX: LiveTreeContext = {
  externalResources: A_EXT,
  internalResources: [],
  sceneCache: cacheOf({ 'res://a.tscn': A_SCENE, 'res://b.tscn': B_SCENE }),
};

describe('walkLiveTree over cyclic instancing', () => {
  it('stops at the instance whose scene instances itself, under each of two siblings', () => {
    expect(allPaths(SELF_ROOTS, SELF_CTX)).toEqual([
      'Root',
      'Root/A',
      'Root/A/A',
      'Root/A/B',
      'Root/B',
      'Root/B/A',
      'Root/B/B',
    ]);
  });

  it('stops an indirect cycle at the instance that names a scene already above it', () => {
    expect(allPaths(A_ROOTS, INDIRECT_CTX)).toEqual([
      'ARoot',
      'ARoot/ToB',
      'ARoot/ToB/ToA',
      'ARoot/ToB/ToA/ToB',
    ]);
  });

  it('expands a scene that two siblings instance, since neither is above the other', () => {
    const leaf: TscnScene = {
      nodes: [makeNode('LeafRoot', 'Node3D', { children: [makeNode('Mesh', 'MeshInstance3D')] })],
      externalResources: [],
      internalResources: [],
    };
    const roots = [
      makeNode('Root', 'Node3D', {
        children: [
          makeNode('L1', 'Node3D', { instance: 'ExtResource("1")' }),
          makeNode('L2', 'Node3D', { instance: 'ExtResource("1")' }),
        ],
      }),
    ];
    const ctx: LiveTreeContext = {
      externalResources: [ext('1', 'res://leaf.tscn')],
      internalResources: [],
      sceneCache: cacheOf({ 'res://leaf.tscn': leaf }),
    };

    expect(allPaths(roots, ctx)).toEqual(['Root', 'Root/L1', 'Root/L1/Mesh', 'Root/L2', 'Root/L2/Mesh']);
  });
});

describe('liveChildGroups and instancedScenePaths', () => {
  const instance = makeNode('A', 'Node3D', { instance: 'ExtResource("1")' });

  it('records the instanced scene on the merged group, after the scenes above it', () => {
    const scope: SceneScope = {
      externalResources: SELF_EXT,
      internalResources: [],
      instancedScenePaths: ['res://x.tscn'],
    };
    const [merged] = liveChildGroups(instance, scope, SELF_CTX.sceneCache);
    expect(merged?.origin).toBe('merged');
    expect(merged?.scope.instancedScenePaths).toEqual(['res://x.tscn', 'res://a.tscn']);
  });

  it('keeps an instance of a scene above it inline, in the outer scope', () => {
    const scope: SceneScope = {
      externalResources: SELF_EXT,
      internalResources: [],
      instancedScenePaths: ['res://a.tscn'],
    };
    expect(liveChildGroups(instance, scope, SELF_CTX.sceneCache)).toEqual([
      { origin: 'inline', children: [], scope },
    ]);
  });

  it('records the instanced scene on the subscene group of a multi-root instance', () => {
    const multi: TscnScene = {
      nodes: [makeNode('One', 'Node3D'), makeNode('Two', 'Node3D')],
      externalResources: [],
      internalResources: [],
    };
    const scope: SceneScope = { externalResources: [ext('1', 'res://multi.tscn')], internalResources: [] };
    const groups = liveChildGroups(instance, scope, cacheOf({ 'res://multi.tscn': multi }));
    expect(groups.map((g) => [g.origin, g.scope.instancedScenePaths])).toEqual([
      ['subscene', ['res://multi.tscn']],
    ]);
  });

  it("resolves the merged group in the innermost scene's pools when a root instances another scene", () => {
    const innerExt = [ext('7', 'res://deep.tscn')];
    const inner: TscnScene = {
      nodes: [makeNode('InnerRoot', 'Node3D')],
      externalResources: innerExt,
      internalResources: [],
    };
    const outer: TscnScene = {
      nodes: [makeNode('OuterRoot', 'Node3D', { instance: 'ExtResource("5")' })],
      externalResources: [ext('5', 'res://inner.tscn')],
      internalResources: [],
    };
    const scope: SceneScope = { externalResources: [ext('1', 'res://outer.tscn')], internalResources: [] };
    const cache = cacheOf({ 'res://outer.tscn': outer, 'res://inner.tscn': inner });

    const [merged] = liveChildGroups(instance, scope, cache);
    expect(merged?.scope.externalResources).toBe(innerExt);
    expect(merged?.scope.instancedScenePaths).toEqual(['res://outer.tscn', 'res://inner.tscn']);
  });

  it("stamps a grafted host child with the host's chain, so it may instance the scene it sits in", () => {
    const leaf: TscnScene = {
      nodes: [makeNode('LeafRoot', 'Node3D', { children: [makeNode('Mesh', 'MeshInstance3D')] })],
      externalResources: [],
      internalResources: [],
    };
    const host = makeNode('Gun', 'Node3D', {
      instance: 'ExtResource("1")',
      children: [makeNode('Spare', 'Node3D', { instance: 'ExtResource("1")' })],
    });
    const ctx: LiveTreeContext = {
      externalResources: [ext('1', 'res://leaf.tscn')],
      internalResources: [],
      sceneCache: cacheOf({ 'res://leaf.tscn': leaf }),
    };

    expect(allPaths([host], ctx)).toEqual(['Gun', 'Gun/Mesh', 'Gun/Spare', 'Gun/Spare/Mesh']);
  });
});

describe('collapseLiveNode and instancedScenePaths', () => {
  it('leaves an instance of a scene above it uncollapsed', () => {
    const node = makeNode('A', 'Node3D', { instance: 'ExtResource("1")' });
    const scope: SceneScope = {
      externalResources: SELF_EXT,
      internalResources: [],
      instancedScenePaths: ['res://a.tscn'],
    };
    expect(collapseLiveNode(node, scope, SELF_CTX.sceneCache)).toBe(node);
  });

  it('stops a root that instances its own scene after one merge', () => {
    const selfRooted: TscnScene = {
      nodes: [makeNode('Loop', 'Node3D', { instance: 'ExtResource("1")' })],
      externalResources: [ext('1', 'res://loop.tscn')],
      internalResources: [],
    };
    const node = makeNode('L', 'Node3D', { instance: 'ExtResource("1")' });
    const scope: SceneScope = { externalResources: [ext('1', 'res://loop.tscn')], internalResources: [] };

    const collapsed = collapseLiveNode(node, scope, cacheOf({ 'res://loop.tscn': selfRooted }));
    expect(collapsed.instance).toBe('ExtResource("1")');
    expect(collapsed).not.toBe(node);
  });
});

describe('resolveLiveNode over cyclic instancing', () => {
  it('resolves the stopped instance itself', () => {
    expect(resolveLiveNode('Root/A/B', SELF_ROOTS, SELF_CTX)?.instance).toBe('ExtResource("1")');
  });

  it('returns null below the stopped instance', () => {
    expect(resolveLiveNode('Root/A/B/A', SELF_ROOTS, SELF_CTX)).toBeNull();
  });
});
