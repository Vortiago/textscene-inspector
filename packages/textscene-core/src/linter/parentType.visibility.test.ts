/**
 * `visibleInTreeVerdict` down the Node3D chain, which stops early: a uniform walk
 * of every ancestor's `visible` key answers `hidden` for trees Godot draws. The
 * CanvasItem chain is in `parentType.canvasItemVisibility.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { verdictOf } from './testing/sceneNodes.js';

describe('visibleInTreeVerdict', () => {
  describe('Node3D', () => {
    it('is hidden by its own key, and by a Node3D ancestor', () => {
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Follow" type="PathFollow3D" parent="."]
visible = false
`,
          'Follow'
        )
      ).toBe('hidden');

      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node3D"]
visible = false

[node name="Mid" type="Node3D" parent="."]

[node name="Follow" type="PathFollow3D" parent="Mid"]
`,
          'Follow'
        )
      ).toBe('hidden');
    });

    it('stops at the first non-Node3D ancestor, so a hidden Node3D above it does not count', () => {
      // node_3d.cpp:150 casts the parent to Node3D and stores null otherwise, so
      // the plain Node ends the chain and the hidden root is never read.
      expect(
        verdictOf(
          `[gd_scene format=3]

[node name="Root" type="Node3D"]
visible = false

[node name="Plain" type="Node" parent="."]

[node name="Follow" type="PathFollow3D" parent="Plain"]
`,
          'Follow'
        )
      ).toBe('visible');
    });

    it('cannot know an instanced ancestor inside the chain', () => {
      expect(
        verdictOf(
          `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Rig" instance=ExtResource("1")]

[node name="Follow" type="PathFollow3D" parent="."]
`,
          'Follow'
        )
      ).toBe('unknowable');
    });

    it('ignores an instanced ancestor the chain never reaches', () => {
      expect(
        verdictOf(
          `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Rig" instance=ExtResource("1")]

[node name="Plain" type="Node" parent="."]

[node name="Follow" type="PathFollow3D" parent="Plain"]
`,
          'Follow'
        )
      ).toBe('visible');
    });
  });

  it('leaves a node in neither family visible: it has no is_visible_in_tree()', () => {
    expect(
      verdictOf(
        `[gd_scene format=3]

[node name="Root" type="Node2D"]
visible = false

[node name="Player" type="AnimationPlayer" parent="."]
`,
        'Player'
      )
    ).toBe('visible');
  });
});
