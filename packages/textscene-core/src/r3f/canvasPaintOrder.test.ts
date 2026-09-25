/**
 * The paint-order key's arithmetic (`servers/rendering/renderer_canvas_cull.cpp`
 * lines 274-283): `z_final` dominates, and a bucket keeps the walk's pre-order, with
 * `show_behind_parent` children first and a y-sorted subtree sorted (lines 477-490).
 * `canvasPaintOrder.contract.test.tsx` pins the end-to-end order.
 */
import { describe, it, expect } from 'vitest';
import type { TscnNode } from '../parser/types';
import {
  PAINT_SEQUENCE_STRIDE,
  allocatePaintRange,
  canvasRenderOrder,
  canvasRootRanges,
  layerRankOf,
  layerRanks,
  paintRangeSize,
  WHOLE_CANVAS_RANGE,
} from './canvasPaintOrder';

function node(name: string, type: string, children: TscnNode[] = [], properties = {}): TscnNode {
  return { name, type, properties, children } as unknown as TscnNode;
}

describe('canvasRenderOrder', () => {
  it('orders by z_final before draw sequence', () => {
    // A late-drawn item in a lower z bucket still draws first: the per-z lists
    // are drawn in z order regardless of when the walk appended them.
    const lateButLow = canvasRenderOrder({ layerRank: 0, zFinal: -1, sequence: 900 });
    const earlyButHigh = canvasRenderOrder({ layerRank: 0, zFinal: 0, sequence: 1 });
    expect(lateButLow).toBeLessThan(earlyButHigh);
  });

  it('orders by draw sequence within one z bucket', () => {
    const first = canvasRenderOrder({ layerRank: 0, zFinal: 0, sequence: 1 });
    const second = canvasRenderOrder({ layerRank: 0, zFinal: 0, sequence: 2 });
    expect(first).toBeLessThan(second);
  });

  it('orders by canvas layer before everything else', () => {
    // A CanvasLayer is a canvas of its own, drawn whole in layer order, so even
    // z_index 4096 on a lower layer stays under a lower z on a higher one.
    const lowLayerHighZ = canvasRenderOrder({ layerRank: 0, zFinal: 4096, sequence: 1000 });
    const highLayerLowZ = canvasRenderOrder({ layerRank: 1, zFinal: -4096, sequence: 0 });
    expect(lowLayerHighZ).toBeLessThan(highLayerLowZ);
  });

  it('keeps every key a safe integer across Godot’s full z envelope', () => {
    // `CANVAS_ITEM_Z_MIN/MAX` is ±4096 and the sequence stride has to hold a
    // whole scene's worth of items; the product must still be exactly
    // comparable, since three compares renderOrder with `!==`.
    const extreme = canvasRenderOrder({ layerRank: 64, zFinal: 4096, sequence: PAINT_SEQUENCE_STRIDE - 1 });
    expect(Number.isSafeInteger(extreme)).toBe(true);
  });

  it('saturates a sequence past the stride rather than carrying into the next bucket', () => {
    // A carry would move the item to another z or layer. A tie inside its own
    // bucket is the lesser failure.
    const overflowed = canvasRenderOrder({ layerRank: 0, zFinal: 0, sequence: PAINT_SEQUENCE_STRIDE + 5 });
    const nextBucket = canvasRenderOrder({ layerRank: 0, zFinal: 1, sequence: 0 });
    expect(overflowed).toBeLessThan(nextBucket);
  });

  it('clamps z_final to the canvas envelope rather than letting a bucket escape', () => {
    // Godot clamps the accumulated z (`accumulateCanvasItemZ`); a value past the
    // envelope arriving here would otherwise index a bucket belonging to the
    // next layer up.
    expect(canvasRenderOrder({ layerRank: 0, zFinal: 99999, sequence: 0 })).toBe(
      canvasRenderOrder({ layerRank: 0, zFinal: 4096, sequence: 0 })
    );
  });
});

describe('layerRanks', () => {
  it('ranks the layers a scene actually uses, world layer included', () => {
    // Ranking rather than using `CanvasLayer.layer` raw: the property is a plain
    // int32 assignment in Godot (`CanvasLayer::set_layer`), so the raw value
    // would blow the key's budget while only its order carries meaning.
    const declared = layerRanks([-5, 3, 3]);
    expect(layerRankOf(declared, -5)).toBeLessThan(layerRankOf(declared, 0));
    expect(layerRankOf(declared, 0)).toBeLessThan(layerRankOf(declared, 3));
  });

  it('always ranks the world layer, even in a scene with no CanvasLayer', () => {
    // Only a rank's order means anything, so this asserts that the world layer
    // is ranked and sits above a layer below it.
    const declared = layerRanks([]);
    expect(Number.isInteger(layerRankOf(declared, 0))).toBe(true);
    expect(layerRankOf(declared, -1)).toBeLessThan(layerRankOf(declared, 0));
  });

  it('ranks a layer the scene never declared where its VALUE belongs', () => {
    // Reachable: a `CanvasLayer` inside an instanced sub-scene is not in the
    // tree the declared list was walked from. Answering such a miss with rank 0
    // would drop it under every other layer instead of ordering it.
    const declared = layerRanks([-5, 3]);
    expect(layerRankOf(declared, -10)).toBeLessThan(layerRankOf(declared, -5));
    expect(layerRankOf(declared, 1)).toBeGreaterThan(layerRankOf(declared, 0));
    expect(layerRankOf(declared, 1)).toBeLessThan(layerRankOf(declared, 3));
    expect(layerRankOf(declared, 99)).toBeGreaterThan(layerRankOf(declared, 3));
  });
});

describe('paintRangeSize', () => {
  it('counts the node and every descendant, so a subtree owns a contiguous run', () => {
    const tree = node('Root', 'Node2D', [
      node('A', 'Sprite2D', [node('A1', 'Sprite2D')]),
      node('B', 'ColorRect'),
    ]);
    expect(paintRangeSize(tree)).toBe(4);
  });

  it('reserves room in a tile layer for the rows a y-sort pass expands it into', () => {
    // A y-sorted TileMapLayer draws one group per tile row, interleaved with its
    // siblings, and the row count is known only once the tileset loads.
    expect(paintRangeSize(node('Tiles', 'TileMapLayer'))).toBeGreaterThan(1000);
  });
});

describe('canvasRootRanges', () => {
  // A `CanvasItem` whose parent is not one parents at the canvas
  // (`_enter_canvas`, canvas_item.cpp:246-267), and its draw index comes from
  // `gui_get_canvas_sort_index()` or `CanvasLayer::get_sort_index()`
  // (canvas_item.cpp:222-232, viewport.cpp:3721-3724, canvas_layer.cpp:261-267).

  it('draws a nested canvas root after the whole subtree of the root it hangs under', () => {
    // The counters go out over the `_root_canvas` group (canvas_item.cpp:453-466)
    // in tree pre-order (scene_tree.cpp:333-348, node.h:132-134, node.cpp:2152-2187).
    // The canvas draws in that order (renderer_canvas_cull.h:146-151, :494-511), each
    // root whole, so a nested root draws after everything under the root it hangs under.
    const detached = node('Detached', 'ColorRect');
    const root = node('Root', 'Control', [
      node('Holder', 'Node', [detached]),
      node('Later', 'ColorRect'),
    ]);
    const ranges = allocatePaintRange(WHOLE_CANVAS_RANGE, [root]).children;
    const roots = canvasRootRanges([root], ranges);

    const own = roots.get(root)!;
    const carved = roots.get(detached)!;
    expect(carved.base).toBeGreaterThanOrEqual(own.base + own.size);
    expect(carved.base + carved.size).toBeLessThanOrEqual(ranges[0]!.base + ranges[0]!.size);
  });

  it('keeps a nested canvas root before the NEXT root of the same canvas', () => {
    // Pre-order among the canvas's roots: [First, Detached, Second]. Drawing it
    // last is the CanvasLayer case, where the layer's own children are the roots.
    const detached = node('Detached', 'ColorRect');
    const first = node('First', 'Control', [node('Holder', 'Node', [detached])]);
    const second = node('Second', 'Control');
    const ranges = allocatePaintRange(WHOLE_CANVAS_RANGE, [first, second]).children;
    const roots = canvasRootRanges([first, second], ranges);

    const firstOwn = roots.get(first)!;
    const carved = roots.get(detached)!;
    expect(carved.base).toBeGreaterThanOrEqual(firstOwn.base + firstOwn.size);
    expect(carved.base + carved.size).toBeLessThanOrEqual(roots.get(second)!.base);
  });

  it('makes a top_level item a canvas root under a CanvasItem parent', () => {
    // `get_parent_item()` returns nullptr for a top_level item (canvas_item.cpp:565-571),
    // so it parents at the canvas and takes the canvas's sort counter
    // (`_top_level_raise_self`, canvas_item.cpp:222-232): the tail of the root it
    // hangs under, as a broken CanvasItem chain gives.
    const detached = node('Detached', 'ColorRect', [], { top_level: true });
    const root = node('Root', 'Node2D', [detached, node('Later', 'Sprite2D')]);
    const ranges = allocatePaintRange(WHOLE_CANVAS_RANGE, [root]).children;
    const roots = canvasRootRanges([root], ranges);

    const own = roots.get(root)!;
    const carved = roots.get(detached)!;
    expect(carved.base).toBeGreaterThanOrEqual(own.base + own.size);
    expect(carved.base + carved.size).toBeLessThanOrEqual(ranges[0]!.base + ranges[0]!.size);
  });

  it('leaves an instanced sub-scene alone, whose real parenting the host tree cannot see', () => {
    // The node's own type and children are the sub-scene's; placing its
    // content from what the host tree says would order it against a parent
    // that is not the one it ends up under.
    const inside = node('Inside', 'ColorRect');
    const instanced = { ...node('HUD', 'Node', [inside]), instance: 'ExtResource("1")' } as TscnNode;
    const root = node('Root', 'Control', [instanced]);
    const ranges = allocatePaintRange(WHOLE_CANVAS_RANGE, [root]).children;

    expect(canvasRootRanges([root], ranges).has(inside)).toBe(false);
  });

  it('leaves a tree with no detached item allocated exactly as before', () => {
    // The reserve is what a nested root draws from; a canvas whose items all
    // nest under a CanvasItem parent has none, and must keep the numbers the
    // plain pre-order allocation gives it.
    const root = node('Root', 'Control', [node('A', 'ColorRect'), node('B', 'ColorRect')]);
    const ranges = allocatePaintRange(WHOLE_CANVAS_RANGE, [root]).children;

    expect(paintRangeSize(root)).toBe(3);
    expect(canvasRootRanges([root], ranges).get(root)).toEqual(ranges[0]);
  });
});

describe('allocatePaintRange', () => {
  it('draws a parent before its children, each child owning a distinct run', () => {
    const children = [node('A', 'Sprite2D', [node('A1', 'Sprite2D')]), node('B', 'Sprite2D')];
    const allocated = allocatePaintRange(WHOLE_CANVAS_RANGE, children);

    expect(allocated.self).toBeLessThan(allocated.children[0]!.base);
    expect(allocated.children[0]!.base).toBeLessThan(allocated.children[1]!.base);
    // A's run has to cover A1 as well, or A1 would land on B's sequence.
    expect(allocated.children[0]!.size).toBe(2);
    expect(allocated.children[0]!.base + allocated.children[0]!.size).toBeLessThanOrEqual(
      allocated.children[1]!.base
    );
  });

  it('draws a show_behind_parent child BEFORE the parent it hangs under', () => {
    // `_cull_canvas_item` runs its behind-children loop, then attaches the item,
    // then its remaining children (lines 477-490).
    const children = [
      node('Behind', 'Sprite2D', [], { show_behind_parent: true }),
      node('Front', 'Sprite2D'),
    ];
    const allocated = allocatePaintRange(WHOLE_CANVAS_RANGE, children);

    expect(allocated.children[0]!.base).toBeLessThan(allocated.self);
    expect(allocated.self).toBeLessThan(allocated.children[1]!.base);
  });

  it('puts a y-sorting parent at the FRONT of its range, ignoring show_behind_parent', () => {
    // `_cull_canvas_item` takes `_collect_ysort_children` for a y-sorted node and
    // runs no behind/ahead split. With one, the parent's sequence moves past
    // `range.base`, and the y-sort pass runs off the end of its range.
    const children = [
      node('Behind', 'Sprite2D', [], { show_behind_parent: true }),
      node('Front', 'Sprite2D'),
    ];
    const range = { base: 10, size: paintRangeSize(node('P', 'Node2D', children)) };
    const sorted = allocatePaintRange(range, children, true);

    expect(sorted.self).toBe(range.base);
    // The whole re-pack, in any order, still fits after it.
    const packed = children.reduce((total, child) => total + paintRangeSize(child), 0);
    expect(sorted.self + 1 + packed).toBeLessThanOrEqual(range.base + range.size);
  });

  it('honours show_behind_parent under either casing the two parsers produce', () => {
    // `Node2DProperties` keeps the `.tscn` snake_case; `ControlProperties` is
    // camelCase. A Control is a CanvasItem and honours the flag exactly as a
    // Node2D does, so reading one key alone silently ignored every Control.
    const control = allocatePaintRange(WHOLE_CANVAS_RANGE, [
      node('Behind', 'ColorRect', [], { showBehindParent: true }),
      node('Front', 'ColorRect'),
    ]);
    expect(control.children[0]!.base).toBeLessThan(control.self);
  });

  it('keeps a subtree that needs MORE than its range inside it anyway', () => {
    // The shape a sub-scene takes: an `instance=` node reserves a flat 4096
    // from the host tree, but the loaded scene is allocated from that reserve
    // and its own TileMapLayer claims another 4096. Running past the end would
    // put the sub-scene's later nodes on top of the host's next sibling.
    const range = { base: 2, size: 4096 };
    const subScene = [node('Tiles', 'TileMapLayer'), node('Player', 'Sprite2D')];
    const allocated = allocatePaintRange(range, subScene);

    const end = range.base + range.size;
    expect(allocated.self).toBeLessThan(end);
    for (const child of allocated.children) {
      expect(child.base).toBeGreaterThanOrEqual(range.base);
      expect(child.base + child.size).toBeLessThanOrEqual(end);
    }
    // Still ordered: the parent first, then the tile layer, then the sprite.
    expect(allocated.self).toBeLessThan(allocated.children[0]!.base);
    expect(allocated.children[0]!.base).toBeLessThan(allocated.children[1]!.base);
  });

  it('keeps a degenerate range ordered as far as it goes, never past its end', () => {
    // Fewer values than children: they cannot all differ, but none may escape.
    // A tie interleaves two subtrees, and an overrun reorders a sibling.
    const range = { base: 10, size: 2 };
    const children = [node('A', 'Sprite2D'), node('B', 'Sprite2D'), node('C', 'Sprite2D')];
    const allocated = allocatePaintRange(range, children);

    const end = range.base + range.size;
    for (const child of allocated.children) {
      expect(child.base).toBeGreaterThanOrEqual(range.base);
      expect(child.base + child.size).toBeLessThanOrEqual(end);
    }
    expect(allocated.children[0]!.base).toBeLessThanOrEqual(allocated.children[1]!.base);
    expect(allocated.children[1]!.base).toBeLessThanOrEqual(allocated.children[2]!.base);
  });

  it('keeps every child inside the range it was given', () => {
    const range = { base: 100, size: 8 };
    const children = [node('A', 'Sprite2D'), node('B', 'Sprite2D', [node('B1', 'Sprite2D')])];
    const allocated = allocatePaintRange(range, children);

    expect(allocated.self).toBeGreaterThanOrEqual(range.base);
    for (const child of allocated.children) {
      expect(child.base).toBeGreaterThanOrEqual(range.base);
      expect(child.base + child.size).toBeLessThanOrEqual(range.base + range.size);
    }
  });
});
