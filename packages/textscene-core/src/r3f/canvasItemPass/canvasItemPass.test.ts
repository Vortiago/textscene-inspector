/**
 * The canvas item pass: a tree in, and for each canvas item by live path its parent item and the
 * state it hands its children, as `RendererCanvasCull::_cull_canvas_item` folds it
 * (`renderer_canvas_cull.cpp:303-489`).
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnScene } from '../../parser/types';
import { liveTreeOf } from '../liveSceneTree';
import { contextOver } from '../liveSceneTree.testkit';
import { canvasItemPass, type CanvasItemPassResult } from './canvasItemPass';
import '../nodes/index';

function parsed(body: string): TscnScene {
  return new TscnParser().parse(`[gd_scene format=3]\n\n${body}`);
}

function passOver(main: TscnScene, scenes: Readonly<Record<string, TscnScene>> = {}) {
  return canvasItemPass(liveTreeOf(main.nodes, contextOver(main, scenes)));
}

function resultAt(results: ReadonlyMap<string, CanvasItemPassResult>, path: string): CanvasItemPassResult {
  const result = results.get(path);
  if (!result) throw new Error(`expected a canvas item at ${path}, got ${[...results.keys()].join(', ')}`);
  return result;
}

describe('canvasItemPass: modulate', () => {
  it('hands down the product of every modulate from the chain start, own included, never self_modulate', () => {
    const results = passOver(
      parsed(`[node name="Root" type="Node2D"]
modulate = Color(0.5, 1, 1, 0.5)

[node name="Mid" type="Node2D" parent="."]
modulate = Color(0.5, 0.25, 1, 1)
self_modulate = Color(0, 0, 0, 0)

[node name="Leaf" type="Polygon2D" parent="Mid"]
`)
    );
    expect(resultAt(results, 'Root/Mid').inherited.modulate).toEqual({ r: 0.25, g: 0.25, b: 1, a: 0.5 });
    expect(resultAt(results, 'Root/Mid/Leaf').parent).toBe('Root/Mid');
  });
});

describe('canvasItemPass: z_final', () => {
  it('adds a relative z to the parent, restarts at an absolute one, and clamps at 4096', () => {
    const results = passOver(
      parsed(`[node name="Root" type="Node2D"]
z_index = 3000

[node name="Over" type="Node2D" parent="."]
z_index = 3000

[node name="Absolute" type="Node2D" parent="Over"]
z_index = -2
z_as_relative = false

[node name="Relative" type="Node2D" parent="Over/Absolute"]
z_index = 5
`)
    );
    // `CLAMP(p_z + z_index, CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX)`, `renderer_canvas_cull.cpp:430-434`.
    expect(resultAt(results, 'Root/Over').inherited.zFinal).toBe(4096);
    expect(resultAt(results, 'Root/Over/Absolute').inherited.zFinal).toBe(-2);
    expect(resultAt(results, 'Root/Over/Absolute/Relative').inherited.zFinal).toBe(3);
  });
});

describe('canvasItemPass: material and sampler', () => {
  it('hands a use_parent_material chain of three the material of the item above it', () => {
    const main = parsed(`[sub_resource type="CanvasItemMaterial" id="Add"]
blend_mode = 1

[node name="Root" type="Node2D"]
material = SubResource("Add")

[node name="A" type="Node2D" parent="."]
use_parent_material = true

[node name="B" type="Node2D" parent="A"]
use_parent_material = true

[node name="C" type="Sprite2D" parent="A/B"]
use_parent_material = true
`);
    const results = passOver(main);
    const material = resultAt(results, 'Root/A/B/C').inherited.material;
    expect(material).toMatchObject({ kind: 'own', ref: 'SubResource("Add")' });
    expect(material.kind === 'own' && material.resources.internalResources).toBe(main.internalResources);
  });

  it('hands no material below an item that names none and does not take its parent’s', () => {
    const results = passOver(
      parsed(`[node name="Root" type="Node2D"]

[node name="Plain" type="Node2D" parent="."]
`)
    );
    expect(resultAt(results, 'Root/Plain').inherited.material).toEqual({ kind: 'none' });
  });

  it('lets a PARENT_NODE link in the middle of a sampler chain take its parent’s filter and repeat', () => {
    const results = passOver(
      parsed(`[node name="Root" type="Node2D"]
texture_filter = 1
texture_repeat = 2

[node name="Middle" type="Node2D" parent="."]

[node name="Own" type="Node2D" parent="Middle"]
texture_filter = 4
`)
    );
    expect(resultAt(results, 'Root/Middle').inherited.sampler).toEqual({ filter: 1, repeat: 2 });
    expect(resultAt(results, 'Root/Middle/Own').inherited.sampler).toEqual({ filter: 4, repeat: 2 });
  });
});

describe('canvasItemPass: where a chain starts', () => {
  const START = {
    modulate: { r: 0.2, g: 0.4, b: 0.9, a: 1 },
    zFinal: 0,
    material: { kind: 'none' },
    sampler: { filter: undefined, repeat: undefined },
  };
  const tinted = (child: string) =>
    parsed(`[node name="Root" type="Node2D"]
modulate = Color(0.5, 0.5, 0.5, 1)
z_index = 7
texture_filter = 1

${child}`);

  it('starts at an item whose parent is no CanvasItem', () => {
    const results = passOver(
      tinted(`[node name="Group" type="Node" parent="."]

[node name="Item" type="Node2D" parent="Group"]
modulate = Color(0.2, 0.4, 0.9, 1)
`)
    );
    expect(results.has('Root/Group')).toBe(false);
    expect(resultAt(results, 'Root/Group/Item')).toMatchObject({ parent: null, inherited: START });
  });

  it('starts at a top_level item, as `get_parent_item` returns null for it (`canvas_item.cpp:565-571`)', () => {
    const results = passOver(
      tinted(`[node name="Item" type="Node2D" parent="."]
top_level = true
modulate = Color(0.2, 0.4, 0.9, 1)
`)
    );
    expect(resultAt(results, 'Root/Item')).toMatchObject({ parent: null, inherited: START });
  });

  it('starts at a top_level Control', () => {
    const results = passOver(
      tinted(`[node name="Item" type="Control" parent="."]
top_level = true
modulate = Color(0.2, 0.4, 0.9, 1)
`)
    );
    expect(resultAt(results, 'Root/Item')).toMatchObject({ parent: null, inherited: START });
  });

  it('starts below a CanvasLayer, which enters its own canvas (`canvas_item.cpp:249-264`)', () => {
    const results = passOver(
      tinted(`[node name="Layer" type="CanvasLayer" parent="."]

[node name="Item" type="Node2D" parent="Layer"]
modulate = Color(0.2, 0.4, 0.9, 1)
`)
    );
    expect(resultAt(results, 'Root/Layer/Item')).toMatchObject({ parent: null, inherited: START });
  });
});

describe('canvasItemPass: Controls and instances', () => {
  it('links a Control below a Node2D below a Control, and folds the Control’s modulate and z', () => {
    const results = passOver(
      parsed(`[node name="Root" type="Control"]
modulate = Color(0.5, 1, 1, 1)
z_index = 2

[node name="Mid" type="Node2D" parent="."]
z_index = 1

[node name="Leaf" type="ColorRect" parent="Mid"]
`)
    );
    const leaf = resultAt(results, 'Root/Mid/Leaf');
    expect(leaf.parent).toBe('Root/Mid');
    expect(leaf.fields.local).toBeNull();
    expect(leaf.inherited).toMatchObject({ modulate: { r: 0.5, g: 1, b: 1, a: 1 }, zFinal: 3 });
  });

  it('keys each instance of one sub-scene by its own path, with its own instance root’s modulate', () => {
    const sub = parsed(`[node name="Body" type="Node2D"]

[node name="Leaf" type="Sprite2D" parent="."]
`);
    const main = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://body.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Red" parent="." instance=ExtResource("1")]
modulate = Color(1, 0, 0, 1)

[node name="Blue" parent="." instance=ExtResource("1")]
modulate = Color(0, 0, 1, 1)
`);
    const results = passOver(main, { 'res://body.tscn': sub });
    expect(resultAt(results, 'Root/Red/Leaf').parent).toBe('Root/Red');
    expect(resultAt(results, 'Root/Red').inherited.modulate).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(resultAt(results, 'Root/Blue').inherited.modulate).toEqual({ r: 0, g: 0, b: 1, a: 1 });
  });

  it('reads the pose a RemoteTransform2D pushes into the item’s own transform', () => {
    const results = passOver(
      parsed(`[node name="Root" type="Node2D"]

[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(70, 80)
remote_path = NodePath("../Held")

[node name="Held" type="Node2D" parent="."]
`)
    );
    expect(resultAt(results, 'Root/Held').fields.local).toMatchObject({ tx: 70, ty: 80 });
  });
});
