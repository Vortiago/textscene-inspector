/**
 * Path2D linter tests — curve resource validation + the missing-curve
 * divergence from Path3D (warning, not error; suppressed when a script is set).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('Path2D Linter', () => {
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a Path2D with a valid Curve2D SubResource and a PathFollow2D child', () => {
    const content = `[gd_scene format=3]

[sub_resource type="Curve2D" id="curve_1"]

[node name="Path2D" type="Path2D"]
curve = SubResource("curve_1")

[node name="PathFollow2D" type="PathFollow2D" parent="."]
`;
    const diagnostics = linter.lint(content);
    expect(diagnostics.filter((d) => d.nodeType === 'Path2D')).toHaveLength(0);
  });

  it('warns (not errors) when a Path2D has no curve and no script', () => {
    const content = `[gd_scene format=3]

[node name="Path2D" type="Path2D"]

[node name="PathFollow2D" type="PathFollow2D" parent="."]
`;
    const diagnostics = linter.lint(content);
    const missing = diagnostics.find((d) => d.ruleName === 'path2d-missing-curve');
    expect(missing).toBeDefined();
    expect(missing!.severity).toBe('warning');
  });

  it('suppresses the missing-curve warning when the node has a script (runtime-assigned)', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://gamepiece.gd" id="1"]

[node name="Path2D" type="Path2D"]
script = ExtResource("1")

[node name="PathFollow2D" type="PathFollow2D" parent="."]
`;
    const diagnostics = linter.lint(content);
    expect(diagnostics.find((d) => d.ruleName === 'path2d-missing-curve')).toBeUndefined();
  });

  it('errors when the curve reference points at a non-existent resource', () => {
    const content = `[gd_scene format=3]

[node name="Path2D" type="Path2D"]
curve = SubResource("does_not_exist")

[node name="PathFollow2D" type="PathFollow2D" parent="."]
`;
    const diagnostics = linter.lint(content);
    const err = diagnostics.find((d) => d.ruleName === 'valid-path2d-resources');
    expect(err).toBeDefined();
    expect(err!.severity).toBe('error');
  });

  it('warns when a Path2D has no PathFollow2D child', () => {
    const content = `[gd_scene format=3]

[sub_resource type="Curve2D" id="curve_1"]

[node name="Path2D" type="Path2D"]
curve = SubResource("curve_1")
`;
    const diagnostics = linter.lint(content);
    expect(diagnostics.find((d) => d.ruleName === 'path2d-unused')).toBeDefined();
  });
});
