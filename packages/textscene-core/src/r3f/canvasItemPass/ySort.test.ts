/**
 * The y-sort over the canvas item pass: a tree in, and the sorted items in the order they draw out,
 * as `_cull_canvas_item` sorts a `sort_y` item's flattened subtree (`renderer_canvas_cull.cpp:437-469`).
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnScene } from '../../parser/types';
import { liveTreeOf } from '../liveSceneTree';
import { contextOver } from '../liveSceneTree.testkit';
import { liveScenePassResults } from '../liveScenePass';
import { canvasItemPass } from './canvasItemPass';
import { canvasPaintPass } from './canvasItemPaint';
import type { PaintRange } from '../canvasPaintOrder';
import { sortedPaintOf, ySortedPaint, type ExtraSortItems, type SortInputs, type SortOrigins } from './ySort';
import '../nodes/index';
import '../controls/index';

function parsed(body: string): TscnScene {
  return new TscnParser().parse(`[gd_scene format=3]\n\n${body}`);
}

const NO_SORT_INPUTS: SortInputs = { origins: new Map(), extras: new Map(), liveYs: new Map() };
const NO_ORIGINS: SortOrigins = NO_SORT_INPUTS.origins;
const NO_EXTRAS: ExtraSortItems = NO_SORT_INPUTS.extras;

/** Each sorted entry's run, by path or extra id. */
function sortedRuns(body: string, origins = NO_ORIGINS, extras = NO_EXTRAS): ReadonlyMap<string, PaintRange> {
  const scene = parsed(body);
  const tree = liveTreeOf(scene.nodes, contextOver(scene, {}));
  return ySortedPaint(
    liveScenePassResults(canvasItemPass, tree),
    liveScenePassResults(canvasPaintPass, tree),
    { origins, extras, liveYs: NO_SORT_INPUTS.liveYs }
  );
}

/** The sorted paths and extra ids in the order their runs draw. */
function sortedOrder(body: string, origins = NO_ORIGINS, extras = NO_EXTRAS): string[] {
  return [...sortedRuns(body, origins, extras)].sort((a, b) => a[1].base - b[1].base).map(([id]) => id);
}

/** A sort root of `type` at (300, 100) holding `A` at y 200 and then `B` at y 100. */
function measuredScene(type: string): string {
  return `[node name="Root" type="Node2D"]

[node name="Sorter" type="${type}" parent="."]
position = Vector2(300, 100)
y_sort_enabled = true

[node name="A" type="Polygon2D" parent="Sorter"]
position = Vector2(0, 200)
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)

[node name="B" type="Polygon2D" parent="Sorter"]
position = Vector2(50, 100)
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)
`;
}

describe('ySortedPaint: the sort root', () => {
  it.each(['Polygon2D', 'Node2D', 'Sprite2D'])('sorts the children of a y-sorted %s by y', (type) => {
    expect(sortedOrder(measuredScene(type))).toEqual(['Root/Sorter', 'Root/Sorter/B', 'Root/Sorter/A']);
  });
});

describe('ySortedPaint: the collection', () => {
  it('draws a child above the root first, since the root is entry 0 at y 0', () => {
    expect(
      sortedOrder(`[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Up" type="Polygon2D" parent="."]
position = Vector2(0, -10)
`)
    ).toEqual(['Root/Up', 'Root']);
  });

  it('keeps collection order for equal ys', () => {
    expect(
      sortedOrder(`[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="First" type="Polygon2D" parent="."]
position = Vector2(0, 50)

[node name="Second" type="Polygon2D" parent="."]
position = Vector2(10, 50)
`)
    ).toEqual(['Root', 'Root/First', 'Root/Second']);
  });

  it('merges a nested sort root into the outer sort, at its composed y', () => {
    expect(
      sortedOrder(`[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Inner" type="Node2D" parent="."]
position = Vector2(0, 100)
y_sort_enabled = true

[node name="Low" type="Polygon2D" parent="Inner"]
position = Vector2(0, 50)

[node name="Mid" type="Polygon2D" parent="."]
position = Vector2(0, 120)
`)
    ).toEqual(['Root', 'Root/Inner', 'Root/Mid', 'Root/Inner/Low']);
  });

  it('draws a child that does not sort as one entry with its whole subtree', () => {
    const order = sortedOrder(`[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Group" type="Node2D" parent="."]
position = Vector2(0, 100)

[node name="Deep" type="Polygon2D" parent="Group"]
position = Vector2(0, -500)
`);
    expect(order).toEqual(['Root', 'Root/Group']);
  });

  it('skips an invisible child', () => {
    expect(
      sortedOrder(`[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Hidden" type="Polygon2D" parent="."]
visible = false

[node name="Shown" type="Polygon2D" parent="."]
position = Vector2(0, 10)
`)
    ).toEqual(['Root', 'Root/Shown']);
  });

  it('leaves out a top_level child, which parents at the canvas', () => {
    expect(
      sortedOrder(`[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Top" type="Polygon2D" parent="."]
top_level = true

[node name="Shown" type="Polygon2D" parent="."]
position = Vector2(0, 10)
`)
    ).toEqual(['Root', 'Root/Shown']);
  });

  it('sorts on the y of the composed transform, under a rotated parent', () => {
    // Rotated by a quarter turn, the child's +x offset becomes +y in the sort root's space.
    expect(
      sortedOrder(`[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Turned" type="Node2D" parent="."]
rotation = 1.5707964
y_sort_enabled = true

[node name="Far" type="Polygon2D" parent="Turned"]
position = Vector2(200, 0)

[node name="Near" type="Polygon2D" parent="."]
position = Vector2(0, 100)
`)
    ).toEqual(['Root', 'Root/Turned', 'Root/Near', 'Root/Turned/Far']);
  });

  it('sorts a Control on the origin the solve gave it', () => {
    const origins: SortOrigins = new Map([['Root/Panel', { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 300 }]]);
    expect(
      sortedOrder(
        `[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Panel" type="Control" parent="."]

[node name="Ball" type="Polygon2D" parent="."]
position = Vector2(0, 100)
`,
        origins
      )
    ).toEqual(['Root', 'Root/Ball', 'Root/Panel']);
  });

  it("sorts a node's extra pieces at their origin, before its children in collection order", () => {
    const extras: ExtraSortItems = new Map([
      ['Root', [{ id: 'row 50', origin: { x: 0, y: 50 }, size: 1, followsChildren: false }]],
    ]);
    expect(
      sortedOrder(
        `[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Tie" type="Polygon2D" parent="."]
position = Vector2(0, 50)
`,
        NO_ORIGINS,
        extras
      )
    ).toEqual(['Root', 'row 50', 'Root/Tie']);
  });

  it("sorts a node's internal back pieces after its children in collection order", () => {
    const extras: ExtraSortItems = new Map([
      ['Root', [{ id: 'bar 50', origin: { x: 0, y: 50 }, size: 1, followsChildren: true }]],
    ]);
    expect(
      sortedOrder(
        `[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Tie" type="Polygon2D" parent="."]
position = Vector2(0, 50)
`,
        NO_ORIGINS,
        extras
      )
    ).toEqual(['Root', 'Root/Tie', 'bar 50']);
  });

  it("draws a node's extra pieces from the room its run reserves, so each child keeps its whole run", () => {
    const extras: ExtraSortItems = new Map([
      [
        'Root',
        [1, 2, 3].map((y) => ({ id: `row ${y}`, origin: { x: 0, y }, size: 1, followsChildren: false })),
      ],
    ]);
    const runs = sortedRuns(
      `[node name="Root" type="TileMapLayer"]
y_sort_enabled = true

[node name="Group" type="Node2D" parent="."]
position = Vector2(0, 10)

[node name="Deep" type="Polygon2D" parent="Group"]
`,
      NO_ORIGINS,
      extras
    );
    expect(runs.get('Root/Group')?.size).toBe(2);
  });

  it('packs a sort root below a moved entry inside the run the outer sort moved it to', () => {
    const runs = sortedRuns(`[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Moved" type="Node2D" parent="."]
position = Vector2(0, 100)

[node name="Inner" type="Node2D" parent="Moved"]
y_sort_enabled = true

[node name="Leaf" type="Polygon2D" parent="Moved/Inner"]

[node name="Up" type="Node2D" parent="."]
position = Vector2(0, 50)

[node name="Up1" type="Polygon2D" parent="Up"]

[node name="Up2" type="Polygon2D" parent="Up"]

[node name="Up3" type="Polygon2D" parent="Up"]
`);
    const moved = runs.get('Root/Moved')!;
    const leaf = runs.get('Root/Moved/Inner/Leaf')!;
    expect(leaf.base).toBeGreaterThanOrEqual(moved.base);
    expect(leaf.base + leaf.size).toBeLessThanOrEqual(moved.base + moved.size);
  });
});

describe('sortedPaintOf: a merged entry whose pieces take their own runs', () => {
  it('keeps its back pieces inside its run', () => {
    const scene = parsed(`[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Scroll" type="ScrollContainer" parent="."]
y_sort_enabled = true

[node name="Content" type="ColorRect" parent="Scroll"]
`);
    const tree = liveTreeOf(scene.nodes, contextOver(scene, {}));
    const paints = liveScenePassResults(canvasPaintPass, tree);
    const pieces: ExtraSortItems = new Map([
      [
        'Root/Scroll',
        ['a', 'b', 'c', 'd'].map((name) => ({
          id: `Root/Scroll#${name}`,
          origin: { x: 0, y: 0 },
          size: 1,
          followsChildren: true,
        })),
      ],
    ]);
    const runs = ySortedPaint(liveScenePassResults(canvasItemPass, tree), paints, {
      ...NO_SORT_INPUTS,
      extras: pieces,
    });
    const run = runs.get('Root/Scroll')!;
    const drawn = sortedPaintOf('Root/Scroll', paints.get('Root/Scroll')!, runs, paints);
    expect(drawn.back.base).toBeGreaterThanOrEqual(run.base);
    expect(drawn.back.base).toBeLessThan(run.base + run.size);
  });
});

describe('sortedPaintOf: a sorted entry whose front room holds child runs', () => {
  it("keeps a y-sorted TileMap's layer room out of its body", () => {
    // The layers are internal front children (`tile_map.cpp:277-279`), so they take runs of their own in the sort.
    const scene = parsed(`[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Map" type="TileMap" parent="."]
y_sort_enabled = true
format = 2
layer_0/y_sort_enabled = true
layer_1/y_sort_enabled = true

[node name="Child" type="Polygon2D" parent="Map"]
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10)
`);
    const tree = liveTreeOf(scene.nodes, contextOver(scene, {}));
    const paints = liveScenePassResults(canvasPaintPass, tree);
    const runs = ySortedPaint(liveScenePassResults(canvasItemPass, tree), paints, NO_SORT_INPUTS);
    const drawn = sortedPaintOf('Root/Map', paints.get('Root/Map')!, runs, paints);
    expect(drawn.front.size).toBe(0);
  });
});

describe('ySortedPaint: a live y', () => {
  it('reads a live y in the space of the node that gave it', () => {
    const extras: ExtraSortItems = new Map([
      ['Root/Map', [{ id: 'tile', origin: { x: 0, y: 0 }, size: 1, followsChildren: false }]],
    ]);
    const scene = parsed(`[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Map" type="Node2D" parent="."]
position = Vector2(0, 300)
y_sort_enabled = true

[node name="Ball" type="Polygon2D" parent="."]
position = Vector2(0, 100)
`);
    const tree = liveTreeOf(scene.nodes, contextOver(scene, {}));
    const runs = ySortedPaint(
      liveScenePassResults(canvasItemPass, tree),
      liveScenePassResults(canvasPaintPass, tree),
      { origins: NO_ORIGINS, extras, liveYs: new Map([['tile', { y: 10, space: 'Root/Map' }]]) }
    );
    const order = [...runs].sort((a, b) => a[1].base - b[1].base).map(([id]) => id);
    expect(order).toEqual(['Root', 'Root/Ball', 'Root/Map', 'tile']);
  });
});
