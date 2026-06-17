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
