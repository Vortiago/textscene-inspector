/**
 * BUG 1: resolveNodeByPath walks the inline + sub-scene tree exactly as
 * the SceneTreeViewer renders it, so the inspector can resolve any tree
 * row — including nodes inside an instanced PackedScene that are absent
 * from SceneGraph.flattenedNodes.
 */
import { describe, expect, it } from 'vitest';
import { resolveNodeByPath, type CachedSceneSource } from './resolveNodeByPath';
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

  it('resolves the collapsed instance node itself to the merged (root-typed) node', () => {
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
    // resolveNodeByPath returns the matched node from the live root list; the
    // instance node keeps its identity, while its CHILDREN come from the merge.
    expect(node?.name).toBe('Coin1');
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
