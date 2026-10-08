/**
 * node2dWorldPosition places a node through Godot's canvas parent chain
 * (Godot +Y-down, T·R·Skew·S) over the live scene tree, so a Camera2D inside an
 * instanced sub-scene resolves. The chain stops at a `top_level` node and at a
 * parent that is not a CanvasItem.
 */
import { describe, it, expect } from 'vitest';
import { node2dWorldPosition } from './node2dWorldTransform';
// The Instance root merge parses an unregistered root type, here Node2D, with the Node parser.
import '../nodes/node/index';
import type { LiveTreeContext, CachedSceneSource } from './liveSceneTree';
import type { TscnNode, TscnScene, TscnExternalResource } from '../parser/types';

function tnode(
  name: string,
  rawProperties: Record<string, string>,
  children: TscnNode[] = [],
  extras: Partial<TscnNode> = {}
): TscnNode {
  return { name, type: 'Node2D', children, properties: {}, rawProperties, ...extras };
}

const at = (x: number, y: number) => ({ position: `Vector2(${x}, ${y})` });

const emptyCtx: LiveTreeContext = {
  externalResources: [],
  internalResources: [],
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
    const roots = [tnode('A', at(100, 50), [tnode('B', at(10, 20))])];
    expect(node2dWorldPosition(roots, emptyCtx, 'A/B')).toEqual({ x: 110, y: 70 });
  });

  it('applies an ancestor rotation to the child offset (Godot +Y-down, CW-positive)', () => {
    // Parent rotated 90° CW: child local +X maps to world +Y.
    const roots = [tnode('A', { ...at(100, 0), rotation: String(Math.PI / 2) }, [tnode('B', at(10, 0))])];
    const p = node2dWorldPosition(roots, emptyCtx, 'A/B')!;
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(10, 6);
  });

  it('applies an ancestor scale to the child offset', () => {
    const roots = [tnode('A', { scale: 'Vector2(2, 3)' }, [tnode('B', at(5, 5))])];
    expect(node2dWorldPosition(roots, emptyCtx, 'A/B')).toEqual({ x: 10, y: 15 });
  });

  it('returns null for unknown paths', () => {
    expect(node2dWorldPosition([], emptyCtx, 'Nope')).toBeNull();
  });

  it('places a top_level Camera2D under a translated Node2D at its own position', () => {
    const cam = tnode('Cam', { ...at(20, 10), top_level: 'true' }, [], { type: 'Camera2D' });
    const roots = [tnode('World', at(100, 50), [cam])];
    expect(node2dWorldPosition(roots, emptyCtx, 'World/Cam')).toEqual({ x: 20, y: 10 });
  });

  it('places a Camera2D under a Node under a translated Node2D at its own position', () => {
    const cam = tnode('Cam', at(20, 10), [], { type: 'Camera2D' });
    const roots = [tnode('World', at(100, 50), [tnode('Group', {}, [cam], { type: 'Node' })])];
    expect(node2dWorldPosition(roots, emptyCtx, 'World/Group/Cam')).toEqual({ x: 20, y: 10 });
  });

  it('composes a Camera2D inside an instanced sub-scene against the instance transform', () => {
    // game.tscn: World → Player (instance of player.tscn at 100,50).
    // player.tscn: PlayerRoot → Cam (at 20,10). The instance transform replaces
    // the sub-scene root's (ADR-0013), so the camera sits at 120,60.
    const playerScene: TscnScene = {
      nodes: [tnode('PlayerRoot', at(0, 0), [tnode('Cam', at(20, 10), [], { type: 'Camera2D' })])],
      externalResources: [],
      internalResources: [],
    };
    const player = tnode('Player', at(100, 50), [], { type: '', instance: 'ExtResource("p")' });
    const roots = [tnode('World', {}, [player])];
    const ctx: LiveTreeContext = {
      externalResources: [ext('p', 'res://player.tscn')],
      internalResources: [],
      sceneCache: cacheOf({ 'res://player.tscn': playerScene }),
    };

    expect(node2dWorldPosition(roots, ctx, 'World/Player/Cam')).toEqual({ x: 120, y: 60 });
  });
});
