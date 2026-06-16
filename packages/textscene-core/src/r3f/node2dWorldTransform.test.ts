/**
 * node2dWorldPosition — composes a node's ancestor Node2D transforms (Godot
 * +Y-down pixel space, T·R·Skew·S per node, matching the parser semantics)
 * into the node's world position. Non-2D ancestors (plain Node, Node3D)
 * contribute identity. Drives 2D camera framing.
 */
import { describe, it, expect } from 'vitest';
import { node2dWorldPosition } from './node2dWorldTransform';
import type { SceneGraph, SceneNode } from '../core/SceneGraph';
import type { TscnNode } from '../parser/types';

function sceneNode(
  path: string,
  parent: string | null,
  properties: Record<string, unknown>
): SceneNode {
  const name = path.split('/').pop()!;
  return {
    path,
    name,
    data: { name, type: 'Node2D', children: [], properties } as unknown as TscnNode,
    source: 'res://test.tscn',
    parent,
  };
}

function graphOf(nodes: SceneNode[]): SceneGraph {
  return {
    rootScene: 'res://test.tscn',
    scenes: new Map(),
    flattenedNodes: nodes,
    version: 1,
    timestamp: 0,
  } as unknown as SceneGraph;
}

const n2d = (x: number, y: number, rotation = 0, scale = { x: 1, y: 1 }) => ({
  position: { x, y },
  rotation,
  scale,
  skew: 0,
});

describe('node2dWorldPosition', () => {
  it('composes nested translations', () => {
    const graph = graphOf([
      sceneNode('A', null, n2d(100, 50)),
      sceneNode('A/B', 'A', n2d(10, 20)),
    ]);
    expect(node2dWorldPosition(graph, 'A/B')).toEqual({ x: 110, y: 70 });
  });

  it('applies an ancestor rotation to the child offset (Godot +Y-down, CW-positive)', () => {
    // Parent rotated 90° CW: child local +X maps to world +Y.
    const graph = graphOf([
      sceneNode('A', null, n2d(100, 0, Math.PI / 2)),
      sceneNode('A/B', 'A', n2d(10, 0)),
    ]);
    const p = node2dWorldPosition(graph, 'A/B')!;
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(10, 6);
  });

  it('applies ancestor scale and skips non-2D ancestors as identity', () => {
    const graph = graphOf([
      sceneNode('Root', null, {}), // plain container — no 2D transform props
      sceneNode('Root/A', 'Root', n2d(0, 0, 0, { x: 2, y: 3 })),
      sceneNode('Root/A/B', 'Root/A', n2d(5, 5)),
    ]);
    expect(node2dWorldPosition(graph, 'Root/A/B')).toEqual({ x: 10, y: 15 });
  });

  it('returns null for unknown paths', () => {
    expect(node2dWorldPosition(graphOf([]), 'Nope')).toBeNull();
  });
});
