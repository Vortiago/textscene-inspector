/**
 * The paint order of a clipping item's children. Godot gives an item a canvas group only if it has
 * commands (`renderer_canvas_cull.cpp:476`), and without one it draws a behind-parent child before the
 * item and the rest after it.
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../parser/types';
import { allocateNodePaintRange, paintRangeSize } from './canvasPaintOrder';
// Side-effect import: registers Node2D as transform-only, which never draws.
import '../nodes/base/node2d/index.r3f';

function node(
  name: string,
  type: string,
  children: TscnNode[] = [],
  raw: Record<string, string> = {},
  properties: object = {}
): TscnNode {
  return { name, type, properties, rawProperties: raw, children } as unknown as TscnNode;
}

function clippingOwner(type: string) {
  const owner = node(
    'Clip',
    type,
    [node('Front', 'Sprite2D'), node('Behind', 'Sprite2D', [], {}, { show_behind_parent: true })],
    { clip_children: '1' }
  );
  return allocateNodePaintRange({ base: 0, size: paintRangeSize(owner) }, owner);
}

describe('allocateNodePaintRange for a clip_children item', () => {
  it('keeps the plain order for a type that draws nothing, since it has no group', () => {
    const { children, self } = clippingOwner('Node2D');

    expect(children[1]!.base).toBeLessThan(self);
    expect(self).toBeLessThan(children[0]!.base);
  });

  it('draws every child before an item that draws, which has a group', () => {
    const { children, self } = clippingOwner('Polygon2D');

    expect(children[0]!.base).toBeLessThan(self);
    expect(children[1]!.base).toBeLessThan(self);
  });
});
