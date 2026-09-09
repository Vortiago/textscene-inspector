/**
 * Tests for the OpenXRVisibilityMask parent rule
 * (`openxrvisibilitymask-parent-not-xrcamera3d`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

const PARENT_RULE = 'openxrvisibilitymask-parent-not-xrcamera3d';

function ruleDiagnostics(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === PARENT_RULE);
}

describe('OpenXRVisibilityMask parent rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts a mask parented to an XRCamera3D', () => {
    const content = `[gd_scene format=3]

[node name="XRCamera3D" type="XRCamera3D"]

[node name="Mask" type="OpenXRVisibilityMask" parent="."]
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('warns for a mask under any other typed parent', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Mask" type="OpenXRVisibilityMask" parent="."]
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.ruleName).toBe(PARENT_RULE);
    expect(found[0]!.severity).toBe('warning');
    expect(found[0]!.message).toContain('Node3D');
  });

  it('warns for a mask used as the scene root', () => {
    const content = `[gd_scene format=3]

[node name="Mask" type="OpenXRVisibilityMask"]
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain('scene root');
  });

  it('stays quiet when the mask is explicitly hidden', () => {
    // Node3D::is_visible() (node_3d.cpp:1127-1130) reads only the node's own
    // flag, so Godot's own check never fires here either.
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Mask" type="OpenXRVisibilityMask" parent="."]
visible = false
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="Mask" type="OpenXRVisibilityMask" parent="Rig"]
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('leaves its own fixture clean', () => {
    // Whole-file check of the "zero errors and zero warnings" claim, for the
    // rule half; the validator half lives in linterParser.test.ts.
    const content = readFixture('unit-open-xr-visibility-mask.tscn');
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });
});
