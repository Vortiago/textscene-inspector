/**
 * Path2D linter tests — curve resource validation + the missing-curve
 * divergence from Path3D (warning, not error; suppressed when a script is set).
 */
import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectDiagnostic,
  expectNoDiagnostic,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('Path2D Linter', () => {
  it('passes a Path2D with a valid Curve2D SubResource and a PathFollow2D child', () => {
    const content = `[gd_scene format=3]

[sub_resource type="Curve2D" id="curve_1"]

[node name="Path2D" type="Path2D"]
curve = SubResource("curve_1")

[node name="PathFollow2D" type="PathFollow2D" parent="."]
`;
    const diagnostics = lint(content);
    expect(diagnostics.filter((d) => d.nodeType === 'Path2D')).toHaveLength(0);
  });

  it('warns (not errors) when a Path2D has no curve and no script', () => {
    expectDiagnostic(
      scene(node('Path2D'), node('PathFollow2D', {}, { parent: '.' })),
      { ruleName: 'path2d-missing-curve', severity: 'warning' }
    );
  });

  it('suppresses the missing-curve warning when the node has a script (runtime-assigned)', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://gamepiece.gd" id="1"]

[node name="Path2D" type="Path2D"]
script = ExtResource("1")

[node name="PathFollow2D" type="PathFollow2D" parent="."]
`;
    expectNoDiagnostic(content, { ruleName: 'path2d-missing-curve' });
  });

  it('errors when the curve reference points at a non-existent resource', () => {
    expectDiagnostic(
      scene(
        node('Path2D', { curve: 'SubResource("does_not_exist")' }),
        node('PathFollow2D', {}, { parent: '.' })
      ),
      { ruleName: 'valid-path2d-resources', severity: 'error' }
    );
  });

  it('warns when a Path2D has no PathFollow2D child', () => {
    const content = `[gd_scene format=3]

[sub_resource type="Curve2D" id="curve_1"]

[node name="Path2D" type="Path2D"]
curve = SubResource("curve_1")
`;
    expectDiagnostic(content, { ruleName: 'path2d-unused' });
  });
});
