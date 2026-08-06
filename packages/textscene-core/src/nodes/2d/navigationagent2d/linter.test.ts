/**
 * Tests for the NavigationAgent2D parent rule (`valid-navigationagent2d-parent`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

const RULE = 'navigationagent2d-parent-not-node2d';

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

describe('NavigationAgent2D parent rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts an agent under a Node2D-inheriting parent', () => {
    const content = `[gd_scene format=3]

[node name="Body" type="CharacterBody2D"]

[node name="Agent" type="NavigationAgent2D" parent="."]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('accepts an agent directly under a plain Node2D', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Agent" type="NavigationAgent2D" parent="."]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('warns for an agent under a non-Node2D typed parent', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Agent" type="NavigationAgent2D" parent="."]
`;
    const warnings = warningsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('warning');
    expect(warnings[0]!.message).toContain('Node2D');
  });

  it('warns for an agent used as the scene root', () => {
    const content = `[gd_scene format=3]

[node name="Agent" type="NavigationAgent2D"]
`;
    const warnings = warningsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('scene root');
  });

  it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://body.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Body" parent="." instance=ExtResource("1")]

[node name="Agent" type="NavigationAgent2D" parent="Body"]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('does not warn about nodes that are not NavigationAgent2D', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Sprite" type="Sprite2D" parent="."]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });
});
