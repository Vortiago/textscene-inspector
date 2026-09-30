/**
 * Tests for the NavigationAgent3D parent rule (`valid-navigationagent3d`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import { reportsOf } from '../../../linter/testing/tierLists';
import './linterParser';
import './linter';

const RULE = 'navigationagent3d-parent-not-node3d';

describe('NavigationAgent3D parent rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts an agent under a Node3D-inheriting parent', () => {
    const content = `[gd_scene format=3]

[node name="Body" type="CharacterBody3D"]

[node name="Agent" type="NavigationAgent3D" parent="."]
`;
    expect(reportsOf(linter.lint(content), RULE, 'warning')).toEqual([]);
  });

  it('accepts an agent directly under a plain Node3D', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Agent" type="NavigationAgent3D" parent="."]
`;
    expect(reportsOf(linter.lint(content), RULE, 'warning')).toEqual([]);
  });

  it('warns for an agent under a non-Node3D typed parent', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Agent" type="NavigationAgent3D" parent="."]
`;
    const warnings = reportsOf(linter.lint(content), RULE, 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('warning');
    expect(warnings[0]!.message).toContain('Node3D');
  });

  it('warns for an agent used as the scene root', () => {
    const content = `[gd_scene format=3]

[node name="Agent" type="NavigationAgent3D"]
`;
    const warnings = reportsOf(linter.lint(content), RULE, 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('scene root');
  });

  it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://body.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Body" parent="." instance=ExtResource("1")]

[node name="Agent" type="NavigationAgent3D" parent="Body"]
`;
    expect(reportsOf(linter.lint(content), RULE, 'warning')).toEqual([]);
  });

  it('does not warn about nodes that are not NavigationAgent3D', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="Mesh" type="MeshInstance3D" parent="."]
`;
    expect(reportsOf(linter.lint(content), RULE, 'warning')).toEqual([]);
  });
});
