/**
 * Tests for the ParallaxLayer parent rule (`valid-parallaxlayer-parent`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import { reportsOf } from '../../../linter/testing/tierLists';
import './linterParser';
import './linter';

const RULE = 'parallaxlayer-outside-parallaxbackground';

describe('ParallaxLayer parent rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts a layer under a ParallaxBackground', () => {
    const content = `[gd_scene format=3]

[node name="BG" type="ParallaxBackground"]

[node name="Sky" type="ParallaxLayer" parent="."]
motion_scale = Vector2(0.5, 1)
`;
    expect(reportsOf(linter.lint(content), RULE, 'warning')).toEqual([]);
  });

  it('warns for a layer under any other typed parent', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Sky" type="ParallaxLayer" parent="."]
`;
    const warnings = reportsOf(linter.lint(content), RULE, 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('Node2D');
  });

  it('warns for a layer used as the scene root', () => {
    const content = `[gd_scene format=3]

[node name="Sky" type="ParallaxLayer"]
`;
    const warnings = reportsOf(linter.lint(content), RULE, 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('scene root');
  });

  it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
    // `instance=` with no `type=`: the parent's real class lives in another file.
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://bg.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="BG" parent="." instance=ExtResource("1")]

[node name="Extra" type="ParallaxLayer" parent="BG"]
`;
    expect(reportsOf(linter.lint(content), RULE, 'warning')).toEqual([]);
  });

  it('does not warn about nodes that are not ParallaxLayers', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Sprite" type="Sprite2D" parent="."]
`;
    expect(reportsOf(linter.lint(content), RULE, 'warning')).toEqual([]);
  });
});
