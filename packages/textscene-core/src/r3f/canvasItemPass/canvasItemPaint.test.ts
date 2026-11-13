/**
 * The paint pass: a tree in, and the nodes in the order their own pixels draw out, as
 * `_cull_canvas_item` visits them (`renderer_canvas_cull.cpp:477-490`).
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnScene } from '../../parser/types';
import { liveTreeOf } from '../liveSceneTree';
import { contextOver } from '../liveSceneTree.testkit';
import { canvasPaintPass, canvasPaintPassFrom, type CanvasItemPaint } from './canvasItemPaint';
import '../nodes/index';
import '../controls/index';

function parsed(body: string): TscnScene {
  return new TscnParser().parse(`[gd_scene format=3]\n\n${body}`);
}

function paintOver(main: TscnScene, scenes: Readonly<Record<string, TscnScene>> = {}) {
  return canvasPaintPass(liveTreeOf(main.nodes, contextOver(main, scenes)));
}

/** The live paths in the order their own pixels draw, with `extra` pieces placed by their sequence. */
function inPaintOrder(
  paint: ReadonlyMap<string, CanvasItemPaint>,
  extra: ReadonlyMap<string, number> = new Map()
): string[] {
  const own = [...paint].map(([path, item]) => [path, item.own] as const);
  return [...own, ...extra].sort((a, b) => a[1] - b[1]).map(([path]) => path);
}

function paintAt(paint: ReadonlyMap<string, CanvasItemPaint>, path: string): CanvasItemPaint {
  const item = paint.get(path);
  if (!item) throw new Error(`expected paint at ${path}, got ${[...paint.keys()].join(', ')}`);
  return item;
}

describe('canvasPaintPass: tree order', () => {
  it('draws a show_behind_parent child before its parent and the others after it', () => {
    const paint = paintOver(
      parsed(`[node name="Root" type="Node2D"]

[node name="Ahead" type="Node2D" parent="."]

[node name="Behind" type="Node2D" parent="."]
show_behind_parent = true

[node name="Inside" type="Node2D" parent="Behind"]
`)
    );
    expect(inPaintOrder(paint)).toEqual(['Root/Behind', 'Root/Behind/Inside', 'Root', 'Root/Ahead']);
    expect(paintAt(paint, 'Root').behind).toEqual([paintAt(paint, 'Root/Behind').range]);
  });

  it('draws every child of a CanvasGroup before the group', () => {
    const paint = paintOver(
      parsed(`[node name="Root" type="Node2D"]

[node name="Group" type="CanvasGroup" parent="."]

[node name="A" type="Node2D" parent="Group"]

[node name="B" type="Node2D" parent="Group"]
`)
    );
    expect(inPaintOrder(paint)).toEqual(['Root', 'Root/Group/A', 'Root/Group/B', 'Root/Group']);
  });

  it('holds a TileMap front room for its layers before its authored children', () => {
    const paint = paintOver(
      parsed(`[node name="Map" type="TileMap"]
layer_0/name = "a"
layer_1/name = "b"
layer_2/name = "c"

[node name="Child" type="Node2D" parent="."]
`)
    );
    const map = paintAt(paint, 'Map');
    expect(map.front).toEqual({ base: map.own + 1, size: 3 });
    expect(paintAt(paint, 'Map/Child').own).toBe(map.front.base + map.front.size);
  });

  it('draws a Control back room after its whole subtree', () => {
    const paint = paintOver(
      parsed(`[node name="Scroll" type="ScrollContainer"]

[node name="Content" type="Control" parent="."]

[node name="Leaf" type="ColorRect" parent="Content"]
`)
    );
    const bars = new Map([['Scroll bars', paintAt(paint, 'Scroll').back.base]]);
    expect(inPaintOrder(paint, bars)).toEqual([
      'Scroll',
      'Scroll/Content',
      'Scroll/Content/Leaf',
      'Scroll bars',
    ]);
  });

  it('draws GraphEdit frames in reverse, then its connections layer, then the other children', () => {
    const paint = paintOver(
      parsed(`[node name="Graph" type="GraphEdit"]

[node name="FrameA" type="GraphFrame" parent="."]

[node name="Node" type="GraphNode" parent="."]

[node name="FrameB" type="GraphFrame" parent="."]
`)
    );
    const layer = new Map([['connections', paintAt(paint, 'Graph').layer]]);
    expect(inPaintOrder(paint, layer)).toEqual([
      'Graph',
      'Graph/FrameB',
      'Graph/FrameA',
      'connections',
      'Graph/Node',
    ]);
  });
});

describe('canvasPaintPass: instances', () => {
  const part = parsed(`[node name="Part" type="Node2D"]

[node name="Shape" type="Polygon2D" parent="."]
`);
  const host = parsed(`[ext_resource type="PackedScene" path="res://part.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="First" parent="." instance=ExtResource("1")]

[node name="Second" parent="." instance=ExtResource("1")]

[node name="Extra" type="Node2D" parent="Second"]

[node name="Over" type="Node2D" parent="."]
`);

  it('gives each instance of one sub-scene its own run, by live path', () => {
    const paint = paintOver(host, { 'res://part.tscn': part });
    expect(inPaintOrder(paint)).toEqual([
      'Root',
      'Root/First',
      'Root/First/Shape',
      'Root/Second',
      'Root/Second/Shape',
      'Root/Second/Extra',
      'Root/Over',
    ]);
  });

  it('starts the roots at the run it is given', () => {
    const start = { base: 1000, size: 100_000 };
    const paint = canvasPaintPassFrom(start)(
      liveTreeOf(host.nodes, contextOver(host, { 'res://part.tscn': part }))
    );
    // The run's first value stays with what holds the roots, as a parent's own value does.
    expect(paintAt(paint, 'Root').range.base).toBe(start.base + 1);
  });
});
