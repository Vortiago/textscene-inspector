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
   * `robot_3d.tscn`), so it is treated as 3D content — a Control sub-scene is
   * the documented miss.
   */
  it('treats an instanced sub-scene as 3d content', () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://robot.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Robot" parent="Viewport" instance=ExtResource("1")]
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
