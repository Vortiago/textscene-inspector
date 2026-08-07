/**
 * Tests for the XROrigin3D rule (`valid-xrorigin3d`): the missing-XRCamera3D
 * child warning and the unsupported-scale warning.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
import '../../../base/node3d/linterParser';
import './linterParser';
import './linter';

const CAMERA_CHILD_RULE = 'xrorigin3d-missing-camera-child';
const SCALE_RULE = 'xrorigin3d-unsupported-scale';

function ruleDiagnostics(diagnostics: ReturnType<Linter['lint']>, ruleName: string) {
  return diagnostics.filter((d) => d.ruleName === ruleName);
}

describe('XROrigin3D rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  describe('camera-child check', () => {
    it('accepts an XROrigin3D with a direct XRCamera3D child', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="Camera" type="XRCamera3D" parent="."]
`;
      expect(ruleDiagnostics(linter.lint(content), CAMERA_CHILD_RULE)).toEqual([]);
    });

    it('warns when no child is an XRCamera3D', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="NotACamera" type="Node3D" parent="."]
`;
      const found = ruleDiagnostics(linter.lint(content), CAMERA_CHILD_RULE);
      expect(found).toHaveLength(1);
      expect(found[0]!.severity).toBe('warning');
    });

    it('warns when the origin has no children at all', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]
`;
      expect(ruleDiagnostics(linter.lint(content), CAMERA_CHILD_RULE)).toHaveLength(1);
    });

    it('does not require the camera to be a DIRECT child\'s only role — a grandchild camera still does not satisfy get_child(i)', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="Rig" type="Node3D" parent="."]

[node name="Camera" type="XRCamera3D" parent="Rig"]
`;
      expect(ruleDiagnostics(linter.lint(content), CAMERA_CHILD_RULE)).toHaveLength(1);
    });

    it('stays quiet when a child is an untyped instance whose type it cannot know', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Origin" type="XROrigin3D"]

[node name="Rig" parent="." instance=ExtResource("1")]
`;
      expect(ruleDiagnostics(linter.lint(content), CAMERA_CHILD_RULE)).toEqual([]);
    });

    it('stays quiet when the origin is explicitly hidden', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]
visible = false
`;
      expect(ruleDiagnostics(linter.lint(content), CAMERA_CHILD_RULE)).toEqual([]);
    });
  });

  describe('scale check', () => {
    it('accepts an identity transform', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)

[node name="Camera" type="XRCamera3D" parent="."]
`;
      expect(ruleDiagnostics(linter.lint(content), SCALE_RULE)).toEqual([]);
    });

    it('accepts no transform at all — identity by omission', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]

[node name="Camera" type="XRCamera3D" parent="."]
`;
      expect(ruleDiagnostics(linter.lint(content), SCALE_RULE)).toEqual([]);
    });

    it('warns on a scaled transform', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]
transform = Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0)

[node name="Camera" type="XRCamera3D" parent="."]
`;
      const found = ruleDiagnostics(linter.lint(content), SCALE_RULE);
      expect(found).toHaveLength(1);
      expect(found[0]!.severity).toBe('warning');
    });

    it('warns on a non-uniformly scaled transform', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]
transform = Transform3D(1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0)

[node name="Camera" type="XRCamera3D" parent="."]
`;
      expect(ruleDiagnostics(linter.lint(content), SCALE_RULE)).toHaveLength(1);
    });

    it('stays quiet when the origin is explicitly hidden', () => {
      const content = `[gd_scene format=3]

[node name="Origin" type="XROrigin3D"]
transform = Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0)
visible = false

[node name="Camera" type="XRCamera3D" parent="."]
`;
      expect(ruleDiagnostics(linter.lint(content), SCALE_RULE)).toEqual([]);
    });
  });

  it('leaves its own fixture clean of both rules', () => {
    const content = readFixture('unit-xr-origin-3d.tscn');
    const diagnostics = linter.lint(content);
    expect(ruleDiagnostics(diagnostics, CAMERA_CHILD_RULE)).toEqual([]);
    expect(ruleDiagnostics(diagnostics, SCALE_RULE)).toEqual([]);
  });
});
