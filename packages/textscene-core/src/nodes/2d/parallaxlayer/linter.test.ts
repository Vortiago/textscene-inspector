/**
 * Tests for the ParallaxLayer parent rule (`valid-parallaxlayer-parent`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

const RULE = 'parallaxlayer-outside-parallaxbackground';

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

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
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('warns for a layer under any other typed parent', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Sky" type="ParallaxLayer" parent="."]
`;
    const warnings = warningsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('warning');
    expect(warnings[0]!.message).toContain('Node2D');
  });

  it('warns for a layer used as the scene root', () => {
    const content = `[gd_scene format=3]

[node name="Sky" type="ParallaxLayer"]
`;
    const warnings = warningsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('scene root');
  });

  it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
    // `game_splitscreen.tscn` writes exactly this shape: `instance=` with no
    // `type=`, so the parent's real class lives in another file.
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://bg.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="BG" parent="." instance=ExtResource("1")]

[node name="Extra" type="ParallaxLayer" parent="BG"]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('does not warn about nodes that are not ParallaxLayers', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Sprite" type="Sprite2D" parent="."]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });
});
