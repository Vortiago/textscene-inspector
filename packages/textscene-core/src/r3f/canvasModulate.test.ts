/**
 * `canvasModulateColor`: which CanvasModulate governs a canvas, including a
 * childless one beside the level, which a subtree-scoped reading ignores.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import { canvasModulateColor } from './canvasModulate';
import { WHITE_MODULATE } from './canvasItemModulate';
import { contextOver } from './liveSceneTree.testkit';
import type { TscnScene } from '../parser/types';

const parse = (tscn: string): TscnScene => new TscnParser().parse(tscn);

function colorOf(tscn: string, scenes: Record<string, TscnScene> = {}) {
  const scene = parse(tscn);
  return canvasModulateColor(scene.nodes, contextOver(scene, scenes));
}

describe('canvasModulateColor', () => {
  it('is white — the modulate identity — when the scene has none', () => {
    expect(
      colorOf(`[gd_scene format=3]

[node name="Root" type="Node2D"]
`)
    ).toEqual(WHITE_MODULATE);
  });

  it('finds a CHILDLESS CanvasModulate declared as a sibling of the content', () => {
    // A subtree-scoped modulate would tint nothing here.
    const c = colorOf(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Level" type="Node2D" parent="."]

[node name="CanvasModulate" type="CanvasModulate" parent="."]
color = Color(0.466667, 0.635294, 0.92549, 1)
`);
    expect(c.r).toBeCloseTo(0.466667, 5);
    expect(c.g).toBeCloseTo(0.635294, 5);
    expect(c.b).toBeCloseTo(0.92549, 5);
  });

  it('takes the LAST in document order — several do not compose, the last to enter wins', () => {
    const c = colorOf(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="First" type="CanvasModulate" parent="."]
color = Color(1, 0, 0, 1)

[node name="Second" type="CanvasModulate" parent="."]
color = Color(0, 0, 1, 1)
`);
    expect(c).toMatchObject({ r: 0, b: 1 });
  });

  it('ignores a hidden one, and one hidden by an ancestor', () => {
    expect(
      colorOf(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Hidden" type="CanvasModulate" parent="."]
visible = false
color = Color(1, 0, 0, 1)
`)
    ).toEqual(WHITE_MODULATE);

    expect(
      colorOf(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="HiddenBranch" type="Node2D" parent="."]
visible = false

[node name="Tint" type="CanvasModulate" parent="HiddenBranch"]
color = Color(1, 0, 0, 1)
`)
    ).toEqual(WHITE_MODULATE);
  });

  it('does not reach into a CanvasLayer — that is a canvas of its own', () => {
    expect(
      colorOf(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Overlay" type="CanvasLayer" parent="."]

[node name="Tint" type="CanvasModulate" parent="Overlay"]
color = Color(1, 0, 0, 1)
`)
    ).toEqual(WHITE_MODULATE);
  });
  it('does not reach into a SubViewport: its World2D is a canvas of its own', () => {
    expect(
      colorOf(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]

[node name="Tint" type="CanvasModulate" parent="View"]
color = Color(1, 0, 0, 1)
`)
    ).toEqual(WHITE_MODULATE);
  });

  it("serves a SubViewport's own subtree, leaving a nested SubViewport out", () => {
    const scene = parse(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]

[node name="Tint" type="CanvasModulate" parent="View"]
color = Color(1, 0, 0, 1)

[node name="Inner" type="SubViewport" parent="View"]

[node name="InnerTint" type="CanvasModulate" parent="View/Inner"]
color = Color(0, 0, 1, 1)
`);
    const view = scene.nodes[0]!.children[0]!;
    expect(canvasModulateColor(view.children, contextOver(scene, {}))).toMatchObject({ r: 1, g: 0, b: 0 });
  });

  /**
   * An instanced scene's nodes are nodes of the canvas they sit in. `CanvasModulate` reads
   * `get_canvas()` and joins the group of that canvas alone (`canvas_modulate.cpp:33-45`), so it
   * does not matter which file declares it.
   */
  describe('through an instanced sub-scene', () => {
    const TINTED = 'res://tinted.tscn';
    const tinted = parse(`[gd_scene format=3]

[node name="TintedRoot" type="Node2D"]

[node name="Tint" type="CanvasModulate" parent="."]
color = Color(1, 0, 0, 1)
`);
    const host = (instanceProperties = '') => `[gd_scene format=3]

[ext_resource type="PackedScene" path="${TINTED}" id="1"]

[node name="Root" type="Node2D"]

[node name="Tinted" parent="." instance=ExtResource("1")]
${instanceProperties}`;

    it('finds the CanvasModulate the sub-scene declares', () => {
      expect(colorOf(host(), { [TINTED]: tinted })).toMatchObject({ r: 1, g: 0, b: 0 });
    });

    it('leaves it out while the sub-scene is hidden', () => {
      expect(colorOf(host('visible = false'), { [TINTED]: tinted })).toEqual(WHITE_MODULATE);
    });

    it('is white until the sub-scene is loaded', () => {
      expect(colorOf(host())).toEqual(WHITE_MODULATE);
    });
  });
});
