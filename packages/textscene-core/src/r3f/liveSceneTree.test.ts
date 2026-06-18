/**
 * The live scene tree: a single traversal that composes the SceneGraph's root
 * Nodes with instance sub-scenes (Instance root merge, ADR-0013) and GLB
 * internals into one consistent path space — so consumers (inspector, cameras,
 * stats) stop re-deriving it (and stop truncating at the first instance via
 * flattenedNodes).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  collectLiveNodes,
  collapseLiveNode,
  liveChildren,
  liveNodeChain,
  resolveLiveNode,
  singleSceneCache,
  type LiveTreeContext,
  type CachedSceneSource,
  type CachedGlbSource,
} from './liveSceneTree';
import type { TscnNode, TscnScene, TscnExternalResource } from '../parser/types';

function makeNode(name: string, type: string, extras: Partial<TscnNode> = {}): TscnNode {
  return { name, type, children: [], properties: {}, ...extras };
}

function cacheOf(entries: Record<string, TscnScene>): CachedSceneSource {
  return { getCached: (p) => entries[p] };
}

function ext(id: string, path: string): TscnExternalResource {
  return { id, path, type: 'PackedScene' };
}

describe('collectLiveNodes', () => {
  it('collects a Camera3D inside an instanced sub-scene, at its tree-matching path', () => {
    // game.tscn instances player.tscn; player.tscn's Target/Camera3D lives
    // inside the instance — absent from flattenedNodes, present in the live tree.
    const playerScene: TscnScene = {
      nodes: [
        makeNode('Player', 'CharacterBody3D', {
          children: [
            makeNode('Target', 'Node3D', { children: [makeNode('Camera3D', 'Camera3D')] }),
          ],
        }),
      ],
      externalResources: [],
      internalResources: [],
    };
    const roots = [
      makeNode('Game', 'Node3D', {
        children: [makeNode('Player', 'Node3D', { instance: 'ExtResource("4_ray")' })],
      }),
    ];
    const ctx: LiveTreeContext = {
      externalResources: [ext('4_ray', 'res://player.tscn')],
      sceneCache: cacheOf({ 'res://player.tscn': playerScene }),
    };

    const cams = collectLiveNodes(roots, ctx, (n) => n.type === 'Camera3D');
    // Player (instance) collapses (ADR-0013: no wrapper segment) → its child
    // Target/Camera3D is addressed directly under Game/Player.
    expect(cams.map((c) => c.path)).toEqual(['Game/Player/Target/Camera3D']);
    expect(cams[0]!.node.name).toBe('Camera3D');
  });

  it('collects matching nodes from the root scene, across types, with paths', () => {
    const roots = [
      makeNode('Root', 'Node3D', {
        children: [makeNode('Cam', 'Camera3D'), makeNode('Light', 'OmniLight3D')],
      }),
    ];
    const ctx: LiveTreeContext = { externalResources: [], sceneCache: cacheOf({}) };
    const found = collectLiveNodes(roots, ctx, (n) => n.type === 'Camera3D' || n.type === 'OmniLight3D');
    expect(found.map((c) => c.path)).toEqual(['Root/Cam', 'Root/Light']);
  });

  it('descends into GLB internals (walks a GLBSceneRoot hierarchy)', () => {
    const glb = new THREE.Group();
    const mesh = new THREE.Mesh();
    mesh.name = 'body';
    glb.add(mesh);
    const glbCache: CachedGlbSource = { getCached: (p) => (p === 'res://m.glb' ? glb : undefined) };
    const roots = [
      makeNode('m', 'GLBSceneRoot', {
        properties: { glbPath: 'res://m.glb' } as Record<string, unknown>,
      }),
    ];
    const ctx: LiveTreeContext = { externalResources: [], sceneCache: cacheOf({}), glbCache };
    const meshes = collectLiveNodes(roots, ctx, (n) => n.type === 'GLBMesh');
    expect(meshes.map((c) => c.path)).toEqual(['m/body']);
  });

  it('skips a not-yet-cached sub-scene gracefully, and picks it up once cached', () => {
    const sub: TscnScene = {
      nodes: [makeNode('Sub', 'Node3D', { children: [makeNode('Cam', 'Camera3D')] })],
      externalResources: [],
      internalResources: [],
    };
    const roots = [makeNode('A', 'Node3D', { instance: 'ExtResource("1")' })];
    const extRes = [ext('1', 'res://sub.tscn')];

    const notCached: LiveTreeContext = { externalResources: extRes, sceneCache: cacheOf({}) };
    expect(collectLiveNodes(roots, notCached, (n) => n.type === 'Camera3D')).toEqual([]);

    const cached: LiveTreeContext = {
      externalResources: extRes,
      sceneCache: cacheOf({ 'res://sub.tscn': sub }),
    };
    expect(
      collectLiveNodes(roots, cached, (n) => n.type === 'Camera3D').map((c) => c.path)
    ).toEqual(['A/Cam']);
  });
});

describe('collapseLiveNode — identity contract', () => {
  // The viewport + tree retrofits branch on `collapseLiveNode(node) !== node` to
  // decide collapse-vs-fallback. That contract — same reference on every
  // fallback, a fresh node only when the single-root merge applies — must hold,
  // or those branches silently take the wrong path.
  const single = (type: string): TscnScene => ({
    nodes: [makeNode('Root', type, { children: [makeNode('Child', 'Node3D')] })],
    externalResources: [],
    internalResources: [],
  });

  it('returns the SAME node reference for a non-instance node', () => {
    const node = makeNode('Plain', 'Node3D');
    expect(collapseLiveNode(node, [], cacheOf({}))).toBe(node);
  });

  it('returns the SAME node reference when the instance ref is unresolvable', () => {
    const node = makeNode('X', 'Node3D', { instance: 'ExtResource("missing")' });
    expect(collapseLiveNode(node, [ext('1', 'res://a.tscn')], cacheOf({}))).toBe(node);
  });

  it('returns the SAME node reference while the sub-scene is not yet cached', () => {
    const node = makeNode('X', 'Node3D', { instance: 'ExtResource("1")' });
    const res = [ext('1', 'res://a.tscn')];
    expect(collapseLiveNode(node, res, cacheOf({}))).toBe(node);
  });

  it('returns the SAME node reference for a multi-root sub-scene (fallback)', () => {
    const node = makeNode('X', 'Node3D', { instance: 'ExtResource("1")' });
    const res = [ext('1', 'res://multi.tscn')];
    const multi: TscnScene = {
      nodes: [makeNode('A', 'Node3D'), makeNode('B', 'Node3D')],
      externalResources: [],
      internalResources: [],
    };
    expect(collapseLiveNode(node, res, cacheOf({ 'res://multi.tscn': multi }))).toBe(node);
  });

  it('returns the SAME node reference for a lone GLBSceneRoot sub-scene (fallback)', () => {
    const node = makeNode('X', 'Node3D', { instance: 'ExtResource("1")' });
    const res = [ext('1', 'res://m.glb')];
    expect(collapseLiveNode(node, res, cacheOf({ 'res://m.glb': single('GLBSceneRoot') }))).toBe(node);
  });

  it('returns a FRESH merged node (adopting the root type) for a single-root .tscn instance', () => {
    const node = makeNode('Player', 'Node3D', { instance: 'ExtResource("1")' });
    const res = [ext('1', 'res://player.tscn')];
    const merged = collapseLiveNode(node, res, cacheOf({ 'res://player.tscn': single('CharacterBody3D') }));
    expect(merged).not.toBe(node);
    expect(merged.type).toBe('CharacterBody3D');
    expect(merged.name).toBe('Player');
  });
});

describe('liveNodeChain — the root→target chain of EFFECTIVE nodes (for ancestor-composed transforms)', () => {
  it('returns the collapsed-node chain descending into an instanced sub-scene', () => {
    // game.tscn instances player.tscn; the chain to the sub-scene camera must
    // include the COLLAPSED Player (type adopted from the sub-scene root) so an
    // ancestor-transform walk sees the instance node's merged properties.
    const playerScene: TscnScene = {
      nodes: [
        makeNode('PlayerRoot', 'CharacterBody2D', {
          children: [makeNode('Target', 'Node2D', { children: [makeNode('Cam', 'Camera2D')] })],
        }),
      ],
      externalResources: [],
      internalResources: [],
    };
    const roots = [
      makeNode('Game', 'Node2D', {
        children: [makeNode('Player', 'Node2D', { instance: 'ExtResource("4_ray")' })],
      }),
    ];
    const ctx: LiveTreeContext = {
      externalResources: [ext('4_ray', 'res://player.tscn')],
      sceneCache: cacheOf({ 'res://player.tscn': playerScene }),
    };

    const chain = liveNodeChain('Game/Player/Target/Cam', roots, ctx);
    expect(chain?.map((n) => n.name)).toEqual(['Game', 'Player', 'Target', 'Cam']);
    // The Player element is the collapsed instance (ADR-0013: adopts the root type).
    expect(chain?.[1]!.type).toBe('CharacterBody2D');
    expect(chain?.[chain.length - 1]!.type).toBe('Camera2D');
  });

  it('returns null for an unresolvable path', () => {
    const ctx: LiveTreeContext = { externalResources: [], sceneCache: cacheOf({}) };
    expect(liveNodeChain('Nope/Missing', [makeNode('Root', 'Node2D')], ctx)).toBeNull();
  });

  it('returns null for an empty path', () => {
    const ctx: LiveTreeContext = { externalResources: [], sceneCache: cacheOf({}) };
    expect(liveNodeChain('', [makeNode('Root', 'Node2D')], ctx)).toBeNull();
  });

  it('agrees with resolveLiveNode on the last element', () => {
    const roots = [
      makeNode('A', 'Node2D', { children: [makeNode('B', 'Node2D')] }),
    ];
    const ctx: LiveTreeContext = { externalResources: [], sceneCache: cacheOf({}) };
    const chain = liveNodeChain('A/B', roots, ctx);
    expect(chain?.[chain.length - 1]).toBe(resolveLiveNode('A/B', roots, ctx));
  });
});

describe('singleSceneCache — one-entry adapter the tree + viewport hand their loaded sub-scene through', () => {
  it('answers only for its own path (no scope leak to siblings)', () => {
    const sub: TscnScene = {
      nodes: [makeNode('Root', 'Node3D')],
      externalResources: [],
      internalResources: [],
    };
    const cache = singleSceneCache('res://a.tscn', sub);
    expect(cache.getCached('res://a.tscn')).toBe(sub);
    expect(cache.getCached('res://other.tscn')).toBeUndefined();
  });

  it('reports not-cached for a null scene (still loading / failed) so collapse keeps the node', () => {
    const cache = singleSceneCache('res://a.tscn', null);
    expect(cache.getCached('res://a.tscn')).toBeUndefined();
    const node = makeNode('X', 'Node3D', { instance: 'ExtResource("1")' });
    expect(collapseLiveNode(node, [ext('1', 'res://a.tscn')], cache)).toBe(node);
  });

  it('answers for no path when keyed by null (a non-instance row)', () => {
    const cache = singleSceneCache(null, { nodes: [makeNode('R', 'Node3D')] });
    expect(cache.getCached('res://anything.tscn')).toBeUndefined();
  });

  it('drives collapseLiveNode + liveChildren so children switch to the sub-scene resource scope', () => {
    // The platformer-player pattern: player.tscn instances player.glb via
    // player.tscn's OWN ext id — absent from the outer scene's scope.
    const sub: TscnScene = {
      nodes: [
        makeNode('Player', 'CharacterBody3D', {
          children: [makeNode('Model', 'Node3D', { instance: 'ExtResource("glb_1")' })],
        }),
      ],
      externalResources: [ext('glb_1', 'res://player.glb')],
      internalResources: [],
    };
    const node = makeNode('Player', 'Node3D', { instance: 'ExtResource("p")' });
    const outer = [ext('p', 'res://player.tscn')];
    const cache = singleSceneCache('res://player.tscn', sub);

    expect(collapseLiveNode(node, outer, cache).type).toBe('CharacterBody3D');

    const { children, externalResources } = liveChildren(node, outer, cache);
    expect(children.map((c) => c.name)).toEqual(['Model']);
    // Scope switched to the sub-scene's table, so the nested GLB ref resolves.
    expect(externalResources).toBe(sub.externalResources);
  });
});
