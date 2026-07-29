/**
 * The classifier that decides WHICH rasterizer owns a sub-viewport's target.
 *
 * Load-bearing beyond rendering: the offscreen (WebGL) publisher and the DOM
 * rasterizer write into the same `ViewportTextureRegistry` under the same key,
 * so a misclassification is not a wrong picture but two publishers racing.
 */
import { describe, expect, it } from 'vitest';

import { TscnParser } from '../../../parser/TscnParser';
import { viewportContentKind } from './viewportContent';
import '../../../r3f/nodes/index';

/** The `Viewport` node of a parsed one-viewport scene. */
function viewport(body: string) {
  const scene = new TscnParser().parse(`[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
${body}`);
  return scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
}

describe('viewportContentKind', () => {
  it('classifies Node3D content as 3d', () => {
    expect(viewportContentKind(viewport('\n[node name="Box" type="MeshInstance3D" parent="Viewport"]'))).toBe(
      '3d'
    );
  });

  it('classifies 2D-world content as 2d', () => {
    expect(viewportContentKind(viewport('\n[node name="Sprite" type="Sprite2D" parent="Viewport"]'))).toBe(
      '2d'
    );
  });

  /** Controls have no WebGL form — the DOM overlay rasterizes them (ADR-0003). */
  it('classifies Control-only content as dom', () => {
    expect(viewportContentKind(viewport('\n[node name="Panel" type="ColorRect" parent="Viewport"]'))).toBe(
      'dom'
    );
  });

  it('classifies an empty sub-viewport as empty', () => {
    expect(viewportContentKind(viewport(''))).toBe('empty');
  });

  /**
   * An instance node has no type until its sub-scene resolves. Godot's own
   * viewport demos instance 3D sub-scenes (`3d_in_2d.tscn` instances
   * `robot_3d.tscn`), so a bare one is assumed to be 3D content.
   */
  it('treats a bare instanced sub-scene as 3d content', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://robot.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Robot" parent="Viewport" instance=ExtResource("1")]
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('3d');
  });

  /**
   * …but that assumption is SPECULATIVE, and decisive evidence outranks it.
   *
   * A `.tscn` records an instance's own property overrides against the base
   * class they belong to, so a CanvasItem-only key (`modulate`, `z_index`,
   * `skew`, …) or a two-component `position` names the sub-scene's world even
   * though its type is still unknown. `scenes/demos/2d/platformer/
   * game_splitscreen.tscn` is the case: `Viewport1` holds three instances, and
   * assuming 3D for all of them selected a `Camera3D` that does not exist and
   * published a target holding nothing but the clear colour — a wrong picture,
   * not a missing one, and one that looks exactly like a broken blit.
   */
  it('an instance carrying CanvasItem-only overrides is 2d content', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Player" parent="Viewport" instance=ExtResource("1")]
modulate = Color(1, 1.5, 2.5, 1)
z_index = 3
position = Vector2(100, 636.5)
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('2d');
  });

  it('a two-component position alone is enough — Node3D would carry three', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Player" parent="Viewport" instance=ExtResource("1")]
position = Vector2(100, 636.5)
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('2d');
  });

  it('a three-component position keeps the 3d assumption', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://robot.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Robot" parent="Viewport" instance=ExtResource("1")]
position = Vector3(1, 2, 3)
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('3d');
  });

  /**
   * The whole point of calling the bare instance's claim speculative: one
   * decisive 2D sibling settles the viewport for both. Godot's split-screen
   * platformer instances an untouched `level.tscn` next to two positioned
   * players, and the level is the content that matters.
   */
  it('a decisive 2D sibling outranks a bare instance’s speculative 3d claim', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://level.tscn" id="1"]
[ext_resource type="PackedScene" path="res://player.tscn" id="2"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Level" parent="Viewport" instance=ExtResource("1")]

[node name="Player" parent="Viewport" instance=ExtResource("2")]
z_index = 3
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('2d');
  });

  /** A REGISTERED 3D type is decisive, so it still wins over 2D evidence. */
  it('a registered 3D node still outranks 2D evidence', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Player" parent="Viewport" instance=ExtResource("1")]
z_index = 3

[node name="Box" type="MeshInstance3D" parent="Viewport"]
`);
    const node = scene.nodes[0]!.children.find((child) => child.type === 'SubViewport')!;
    expect(viewportContentKind(node)).toBe('3d');
  });

  /** 3D beats 2D beats DOM: a mixed target showing its 3D half beats one showing nothing. */
  it('prefers 3d over 2d and dom when kinds are mixed', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Panel" type="ColorRect" parent="Viewport"]

[node name="Sprite" type="Sprite2D" parent="Viewport"]

[node name="Box" type="MeshInstance3D" parent="Viewport"]`)
      )
    ).toBe('3d');
  });

  it('prefers 2d over dom when there is no 3D content', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Panel" type="ColorRect" parent="Viewport"]

[node name="Sprite" type="Sprite2D" parent="Viewport"]`)
      )
    ).toBe('2d');
  });

  /** Content nested under a plain container still counts. */
  it('descends through a plain Node container', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Holder" type="Node" parent="Viewport"]

[node name="Box" type="MeshInstance3D" parent="Viewport/Holder"]`)
      )
    ).toBe('3d');
  });

  /**
   * A nested sub-viewport's subtree draws into ITS target, not this one — that
   * is where `Viewport` rasterisation stops. Counting it would make an outer
   * viewport claim content it never renders.
   */
  it('does not descend into a nested sub-viewport', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Inner" type="SubViewport" parent="Viewport"]

[node name="Box" type="MeshInstance3D" parent="Viewport/Inner"]`)
      )
    ).toBe('empty');
  });

  /** A Control wrapping 3D content still yields a WebGL source. */
  it('finds 3D content nested under a Control', () => {
    expect(
      viewportContentKind(
        viewport(`
[node name="Panel" type="ColorRect" parent="Viewport"]

[node name="Box" type="MeshInstance3D" parent="Viewport/Panel"]`)
      )
    ).toBe('3d');
  });
});
