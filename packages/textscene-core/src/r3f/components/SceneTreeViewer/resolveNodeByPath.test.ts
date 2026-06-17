/**
 * BUG 1: resolveNodeByPath walks the inline + sub-scene tree exactly as
 * the SceneTreeViewer renders it, so the inspector can resolve any tree
 * row — including nodes inside an instanced PackedScene that are absent
 * from SceneGraph.flattenedNodes.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolveNodeByPath, type CachedSceneSource, type CachedGlbSource } from './resolveNodeByPath';
import type { TscnNode, TscnScene, TscnExternalResource } from '../../../parser/types';

function makeNode(name: string, type: string, extras: Partial<TscnNode> = {}): TscnNode {
  return { name, type, children: [], properties: {}, ...extras };
}

function cacheOf(entries: Record<string, TscnScene>): CachedSceneSource {
  return { getCached: (p) => entries[p] };
}

const EXT: TscnExternalResource[] = [
  { id: '3_as5ck', path: 'res://roof_lamp.tscn', type: 'PackedScene' },
];

describe('resolveNodeByPath', () => {
  it('resolves an inline node by path', () => {
    const roots = [
      makeNode('Hallway', 'Node3D', {
        children: [makeNode('Table', 'Node3D')],
      }),
    ];
    const node = resolveNodeByPath('Hallway/Table', roots, [], cacheOf({}));
    expect(node?.name).toBe('Table');
  });

  it('descends into a GLBSceneRoot to resolve an internal GLB node', () => {
    const roots = [
      makeNode('player', 'GLBSceneRoot', {
        properties: { glbPath: 'res://player.glb' } as Record<string, unknown>,
      }),
    ];
    const glbRoot = new THREE.Group();
    const armature = new THREE.Group();
    armature.name = 'Armature';
    const hand = new THREE.Mesh();
    hand.name = 'hand';
    armature.add(hand);
    glbRoot.add(armature);
    const glbCache: CachedGlbSource = { getCached: (p) => (p === 'res://player.glb' ? glbRoot : undefined) };

    const node = resolveNodeByPath('player/Armature/hand', roots, [], cacheOf({}), glbCache);
    expect(node?.name).toBe('hand');
    expect(node?.type).toBe('GLBMesh');
  });

  it('descends into a collapsed instanced sub-scene interior (BUG 1 + ADR-0013)', () => {
    // The sub-scene root 'LampBody' collapses INTO the instance node
    // 'roof_lamp' (Instance root merge), so the interior 'plafoniera' is
    // addressed directly under the instance node — there is no extra root
    // segment. The path matches what the tree and viewport produce.
    const subScene: TscnScene = {
      nodes: [
        makeNode('LampBody', 'Node3D', {
          children: [makeNode('plafoniera', 'MeshInstance3D')],
        }),
      ],
      externalResources: [],
      internalResources: [],
    };
    const roots = [
      makeNode('HallwayGeometry', 'Node3D', {
        children: [makeNode('roof_lamp', 'Node3D', { instance: 'ExtResource("3_as5ck")' })],
      }),
    ];

    const node = resolveNodeByPath(
      'HallwayGeometry/roof_lamp/plafoniera',
      roots,
      EXT,
      cacheOf({ 'res://roof_lamp.tscn': subScene })
    );
    expect(node?.name).toBe('plafoniera');
    expect(node?.type).toBe('MeshInstance3D');

    // The collapsed root's own name is NOT a path segment anymore.
    expect(
      resolveNodeByPath(
        'HallwayGeometry/roof_lamp/LampBody/plafoniera',
        roots,
        EXT,
        cacheOf({ 'res://roof_lamp.tscn': subScene })
      )
    ).toBeNull();
  });

  it('resolves a selected collapsed instance node to the merged (root-typed) node', () => {
    const subScene: TscnScene = {
      nodes: [makeNode('Coin', 'Area3D', { children: [makeNode('Circle', 'MeshInstance3D')] })],
      externalResources: [],
      internalResources: [],
    };
    const roots = [makeNode('Coin1', 'Node3D', { instance: 'ExtResource("3_as5ck")' })];
    const node = resolveNodeByPath(
      'Coin1',
      roots,
      [{ id: '3_as5ck', path: 'res://roof_lamp.tscn', type: 'PackedScene' }],
      cacheOf({ 'res://roof_lamp.tscn': subScene })
    );
    // The Inspector must see the SAME identity the tree row + viewport show:
    // the merged node keeps the instance name but adopts the root's type.
    expect(node?.name).toBe('Coin1');
    expect(node?.type).toBe('Area3D');
  });

  it('descends into a nested instance using the SUB-scene externalResources, not the outer scene', () => {
    // The platformer bug: game.tscn instances player.tscn, which contains an
    // inner node instancing player.glb via player.tscn's OWN ExtResource id —
    // an id absent from game.tscn's resources. Descent must resolve that inner
    // instance against the sub-scene's resource table, not the outer scene's.
    const subB: TscnScene = {
      nodes: [makeNode('BRoot', 'Node3D', { children: [makeNode('Leaf', 'MeshInstance3D')] })],
      externalResources: [],
      internalResources: [],
    };
    const subA: TscnScene = {
      nodes: [
        makeNode('ARoot', 'Node3D', {
          children: [makeNode('Inner', 'Node3D', { instance: 'ExtResource("9_subB")' })],
        }),
      ],
      externalResources: [{ id: '9_subB', path: 'res://subB.tscn', type: 'PackedScene' }],
      internalResources: [],
    };
    const outerExt: TscnExternalResource[] = [
      { id: '1_subA', path: 'res://subA.tscn', type: 'PackedScene' },
    ];
    const roots = [
      makeNode('Outer', 'Node3D', {
        children: [makeNode('A', 'Node3D', { instance: 'ExtResource("1_subA")' })],
      }),
    ];
    const cache = cacheOf({ 'res://subA.tscn': subA, 'res://subB.tscn': subB });

    const node = resolveNodeByPath('Outer/A/Inner/Leaf', roots, outerExt, cache);
    expect(node?.name).toBe('Leaf');
    expect(node?.type).toBe('MeshInstance3D');
  });

  it('returns null when the sub-scene is not yet cached', () => {
    const roots = [makeNode('roof_lamp', 'Node3D', { instance: 'ExtResource("3_as5ck")' })];
    const node = resolveNodeByPath('roof_lamp/plafoniera', roots, EXT, cacheOf({}));
    expect(node).toBeNull();
  });

  it('returns null for an unknown segment', () => {
    const roots = [makeNode('Hallway', 'Node3D')];
    expect(resolveNodeByPath('Hallway/Nope', roots, [], cacheOf({}))).toBeNull();
  });

  it('returns null for an empty path', () => {
    expect(resolveNodeByPath('', [makeNode('A', 'Node3D')], [], cacheOf({}))).toBeNull();
  });
});
