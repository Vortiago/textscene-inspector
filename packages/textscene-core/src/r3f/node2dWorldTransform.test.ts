/**
 * node2dWorldPosition composes a node's ancestor Node2D transforms (Godot +Y-down,
 * T·R·Skew·S) over the live scene tree, so a Camera2D inside an instanced
 * sub-scene resolves. Non-2D ancestors contribute identity.
 */
import { describe, it, expect } from 'vitest';
import { node2dWorldPosition } from './node2dWorldTransform';
import type { LiveTreeContext, CachedSceneSource } from './liveSceneTree';
import type { TscnNode, TscnScene, TscnExternalResource } from '../parser/types';

function tnode(
  name: string,
  properties: Record<string, unknown>,
  children: TscnNode[] = [],
  extras: Partial<TscnNode> = {}
): TscnNode {
  return { name, type: 'Node2D', children, properties, ...extras };
}

const n2d = (x: number, y: number, rotation = 0, scale = { x: 1, y: 1 }) => ({
  position: { x, y },
  rotation,
  scale,
  skew: 0,
});

const emptyCtx: LiveTreeContext = {
  externalResources: [],
  sceneCache: { getCached: () => undefined },
};

function cacheOf(entries: Record<string, TscnScene>): CachedSceneSource {
  return { getCached: (p) => entries[p] };
}

function ext(id: string, path: string): TscnExternalResource {
  return { id, path, type: 'PackedScene' };
}

describe('node2dWorldPosition', () => {
  it('composes nested translations', () => {
    const roots = [tnode('A', n2d(100, 50), [tnode('B', n2d(10, 20))])];
    expect(node2dWorldPosition(roots, emptyCtx, 'A/B')).toEqual({ x: 110, y: 70 });
  });

  it('applies an ancestor rotation to the child offset (Godot +Y-down, CW-positive)', () => {
    // Parent rotated 90° CW: child local +X maps to world +Y.
    const roots = [tnode('A', n2d(100, 0, Math.PI / 2), [tnode('B', n2d(10, 0))])];
    const p = node2dWorldPosition(roots, emptyCtx, 'A/B')!;
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(10, 6);
  });

  it('applies ancestor scale and skips non-2D ancestors as identity', () => {
    const roots = [
      tnode('Root', {}, [
        // A plain container with no 2D transform props is the identity.
        tnode('A', n2d(0, 0, 0, { x: 2, y: 3 }), [tnode('B', n2d(5, 5))]),
      ]),
    ];
    expect(node2dWorldPosition(roots, emptyCtx, 'Root/A/B')).toEqual({ x: 10, y: 15 });
  });

  it('returns null for unknown paths', () => {
    expect(node2dWorldPosition([], emptyCtx, 'Nope')).toBeNull();
  });

  it('composes a Camera2D inside an instanced sub-scene against the instance transform', () => {
    // game.tscn: World → Player (instance of player.tscn at 100,50).
    // player.tscn: PlayerRoot → Cam (at 20,10). The instance transform replaces
    // the sub-scene root's (ADR-0013), so the camera sits at 120,60.
    const playerScene: TscnScene = {
      nodes: [tnode('PlayerRoot', n2d(0, 0), [tnode('Cam', n2d(20, 10))])],
      externalResources: [],
      internalResources: [],
    };
    const roots = [
      tnode('World', {}, [tnode('Player', n2d(100, 50), [], { instance: 'ExtResource("p")' })]),
    ];
    const ctx: LiveTreeContext = {
      externalResources: [ext('p', 'res://player.tscn')],
      sceneCache: cacheOf({ 'res://player.tscn': playerScene }),
    };

    expect(node2dWorldPosition(roots, ctx, 'World/Player/Cam')).toEqual({ x: 120, y: 60 });
  });
});
