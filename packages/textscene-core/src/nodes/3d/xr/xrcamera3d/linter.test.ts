/**
 * Tests for the XRCamera3D parent rule (`xrcamera3d-parent-not-xrorigin3d`).
 *
 * Goes through `Linter` directly rather than the barrel: `Linter.ts` imports
 * only `StrictTscnParser` and `RuleRegistry`, neither of which touches
 * `linter/index.ts` (the barrel every sibling slice's `index.linter.ts`
 * registers into), so this stays safe to run mid-wave — the same shape
 * `navigationagent3d/linter.test.ts` and `openxrvisibilitymask/linter.test.ts`
 * already use.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { readFixture, expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import '../../../base/node3d/linterParser';
import './linter';

const PARENT_RULE = 'xrcamera3d-parent-not-xrorigin3d';

function ruleDiagnostics(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === PARENT_RULE);
}

describe('XRCamera3D parent rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('accepts a camera parented to an XROrigin3D', () => {
    const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="Camera" type="XRCamera3D" parent="."]
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('warns for a camera under any other typed parent', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Camera" type="XRCamera3D" parent="."]
`;
    const found = ruleDiagnostics(linter.lint(content));
    expect(found).toHaveLength(1);
    expect(found[0]!.ruleName).toBe(PARENT_RULE);
    expect(found[0]!.severity).toBe('warning');
    expect(found[0]!.message).toContain('Node3D');
  });

  it('stays quiet when the camera has no parent at all — xr_nodes.cpp:97 guards on `parent &&`, unlike NavigationAgent/OpenXR', () => {
    const content = `[gd_scene format=3]

[node name="Camera" type="XRCamera3D"]
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('stays quiet when the camera is explicitly hidden', () => {
    // Node3D::is_visible() (node_3d.cpp:1127-1130) reads only the node's own
    // flag, so Godot's own check never fires here either.
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Camera" type="XRCamera3D" parent="."]
visible = false
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="Camera" type="XRCamera3D" parent="Rig"]
`;
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('leaves its own fixture clean of this rule', () => {
    const content = readFixture('unit-xr-camera-3d.tscn');
    expect(ruleDiagnostics(linter.lint(content))).toEqual([]);
  });

  it('leaves its own fixture clean overall — zero errors, zero warnings', () => {
    // XRCamera3D declares no properties of its own, so there is no
    // linterParser.test.ts to carry this claim; it runs here instead, against
    // whatever this file imported (the inherited Node3D `transform` validator).
    expectFixtureClean('unit-xr-camera-3d.tscn');
  });
});
