/**
 * `canvasModulateColor` — which CanvasModulate governs a canvas.
 *
 * The case that matters is the one the isometric dungeon authors: a CHILDLESS
 * CanvasModulate sitting beside the level, which a subtree-scoped reading turns
 * into a no-op.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import { canvasModulateColor } from './canvasModulate';
import { WHITE_MODULATE } from './canvasItemModulate';

function colorOf(tscn: string) {
  return canvasModulateColor(new TscnParser().parse(tscn).nodes);
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
    // Exactly the dungeon's shape, and the reason a subtree modulate was inert.
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
});
