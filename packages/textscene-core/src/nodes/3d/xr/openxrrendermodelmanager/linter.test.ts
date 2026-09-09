/**
 * Tests for the OpenXRRenderModelManager configuration-warning rules
 * (`openxrrendermodelmanager-tracker-required-for-local-pose` /
 * `openxrrendermodelmanager-parent-not-xrorigin3d`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

const TRACKER_RULE = 'openxrrendermodelmanager-tracker-required-for-local-pose';
const PARENT_RULE = 'openxrrendermodelmanager-parent-not-xrorigin3d';

function ruleDiagnostics(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === TRACKER_RULE || d.ruleName === PARENT_RULE);
}

describe('OpenXRRenderModelManager configuration-warning rules', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts a manager parented to an XROrigin3D with the default tracker', () => {
    const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Manager" type="OpenXRRenderModelManager" parent="."]
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('warns when make_local_to_pose is set while tracker stays at its Any default', () => {
    const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Manager" type="OpenXRRenderModelManager" parent="."]
make_local_to_pose = "aim"
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.ruleName).toBe(TRACKER_RULE);
    expect(found[0]!.severity).toBe('warning');
  });

  it('warns when make_local_to_pose is set and tracker is explicitly None set (1)', () => {
    const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Manager" type="OpenXRRenderModelManager" parent="."]
tracker = 1
make_local_to_pose = "grip"
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found.map((d) => d.ruleName)).toEqual([TRACKER_RULE]);
  });

  it('stays quiet on make_local_to_pose once a hand tracker is picked', () => {
    const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Manager" type="OpenXRRenderModelManager" parent="."]
tracker = 2
make_local_to_pose = "grip"
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  // Godot's own check is `if (!make_local_to_pose.is_empty())` (cpp:204), and a
  // String slot takes the StringName spelling too (variant.cpp:582-590), so both
  // of these are the empty string the class defaults to.
  it.each(['""', '&""'])('stays quiet on an empty make_local_to_pose %s', (pose) => {
    const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Manager" type="OpenXRRenderModelManager" parent="."]
make_local_to_pose = ${pose}
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('warns for a manager under any other typed parent (direct-parent arm)', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Manager" type="OpenXRRenderModelManager" parent="."]
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found.map((d) => d.ruleName)).toEqual([PARENT_RULE]);
  });

  it('warns for a manager used as the scene root (direct-parent arm)', () => {
    const content = `[gd_scene format=3]

[node name="Manager" type="OpenXRRenderModelManager"]
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found.map((d) => d.ruleName)).toEqual([PARENT_RULE]);
  });

  it('accepts a Left Hand tracker whose XROrigin3D is a grandparent, not the direct parent', () => {
    const content = `[gd_scene format=3]

[node name="XROrigin3D" type="XROrigin3D"]

[node name="Group" type="Node3D" parent="."]

[node name="Manager" type="OpenXRRenderModelManager" parent="Group"]
tracker = 2
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('warns for a Left Hand tracker with no XROrigin3D anywhere up the chain', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Group" type="Node3D" parent="."]

[node name="Manager" type="OpenXRRenderModelManager" parent="Group"]
tracker = 3
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found.map((d) => d.ruleName)).toEqual([PARENT_RULE]);
  });

  it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="Manager" type="OpenXRRenderModelManager" parent="Rig"]
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('stays quiet under an instanced ancestor for the Left/Right Hand arm too', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="Manager" type="OpenXRRenderModelManager" parent="Rig"]
tracker = 2
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('leaves its own fixture clean', () => {
    // Whole-file check of the "zero errors and zero warnings" claim, for the
    // rule half; the validator half lives in linterParser.test.ts.
    const content = readFixture('unit-open-xr-render-model-manager.tscn');
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });
});
