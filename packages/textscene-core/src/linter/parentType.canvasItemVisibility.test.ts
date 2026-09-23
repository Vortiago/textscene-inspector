/**
 * `visibleInTreeVerdict` down the CanvasItem chain: a contiguous CanvasItem run,
 * then an immediate CanvasLayer parent, then a Viewport search that climbs past
 * anything else. Node3D has one stopping rule (`parentType.visibility.test.ts`).
 */

import { describe, expect, it } from 'vitest';
import { verdictOf } from './testing/sceneNodes.js';

describe('visibleInTreeVerdict', () => {
  describe('CanvasItem', () => {
    it('cascades through the contiguous CanvasItem run', () => {
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node2D"]
visible = false

[node name="Region" type="NavigationRegion2D" parent="."]
`,
          'Region'
        )
      ).toBe('hidden');
    });

    it('stops at a plain Node, so a hidden Node2D above it does not count', () => {
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node2D"]
visible = false

[node name="Plain" type="Node" parent="."]

[node name="Region" type="NavigationRegion2D" parent="Plain"]
`,
          'Region'
        )
      ).toBe('visible');
    });

    it('reads a CanvasLayer parent, but only as the immediate parent', () => {
      const layer = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Layer" type="CanvasLayer" parent="."]
visible = false
`;
      expect(
        verdictOf(
          `${layer}
[node name="Region" type="NavigationRegion2D" parent="Layer"]
`,
          'Region'
        )
      ).toBe('hidden');

      // canvas_item.cpp:324-328 casts the immediate parent only, so one plain
      // Node between them and the layer contributes nothing.
      expect(
        verdictOf(
          `${layer}
[node name="Plain" type="Node" parent="Layer"]

[node name="Region" type="NavigationRegion2D" parent="Layer/Plain"]
`,
          'Region'
        )
      ).toBe('visible');
    });

    it('reads a hidden Window found by the Viewport search, across plain Nodes', () => {
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Dialog" type="Window"]
visible = false

[node name="Plain" type="Node" parent="."]

[node name="Region" type="NavigationRegion2D" parent="Plain"]
`,
          'Region'
        )
      ).toBe('hidden');
    });

    it('treats any other Viewport ancestor as visible', () => {
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Port" type="SubViewport" parent="."]

[node name="Region" type="NavigationRegion2D" parent="Port"]
`,
          'Region'
        )
      ).toBe('visible');
    });

    it('cannot rule out a hidden Window behind an instanced ancestor', () => {
      // Unlike Node3D, the search climbs past whatever is not a Viewport, so an
      // instanced ancestor above the CanvasItem run is still consulted.
      expect(
        verdictOf(
          `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://dialog.tscn" id="1"]

[node name="Dialog" instance=ExtResource("1")]

[node name="Plain" type="Node" parent="."]

[node name="Region" type="NavigationRegion2D" parent="Plain"]
`,
          'Region'
        )
      ).toBe('unknowable');
    });

    it('cannot rule out a hidden Window behind an uncataloged ancestor', () => {
      // `descendsFrom` is false for "not a Window" and for a class this build
      // has never heard of alike, so the search has to decline on the second.
      // A GDExtension type in this position may be a Window, and then its own
      // `visible` is what decides.
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Custom" type="MyDialogWindow"]
visible = false

[node name="Plain" type="Node" parent="."]

[node name="Region" type="NavigationRegion2D" parent="Plain"]
`,
          'Region'
        )
      ).toBe('unknowable');
    });
  });
});
