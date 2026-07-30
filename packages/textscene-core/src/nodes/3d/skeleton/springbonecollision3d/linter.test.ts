/**
 * Tests for the SpringBoneCollision3D parent rule
 * (`springbonecollision3d-outside-springbonesimulator3d`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

const RULE = 'springbonecollision3d-outside-springbonesimulator3d';

function warningsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

describe('SpringBoneCollision3D parent rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts a collision under a SpringBoneSimulator3D', () => {
    const content = `[gd_scene format=3]

[node name="Sim" type="SpringBoneSimulator3D"]

[node name="Collision" type="SpringBoneCollision3D" parent="."]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('warns for a collision under any other typed parent', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Collision" type="SpringBoneCollision3D" parent="."]
`;
    const warnings = warningsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.severity).toBe('warning');
    expect(warnings[0]!.message).toContain('Node3D');
  });

  it('warns for a collision used as the scene root', () => {
    const content = `[gd_scene format=3]

[node name="Collision" type="SpringBoneCollision3D"]
`;
    const warnings = warningsOf(linter.lint(content));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('scene root');
  });

  it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://sim.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Sim" parent="." instance=ExtResource("1")]

[node name="Extra" type="SpringBoneCollision3D" parent="Sim"]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });

  it('does not warn about nodes that are not SpringBoneCollision3D', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Sim" type="SpringBoneSimulator3D" parent="."]
`;
    expect(warningsOf(linter.lint(content))).toEqual([]);
  });
});
