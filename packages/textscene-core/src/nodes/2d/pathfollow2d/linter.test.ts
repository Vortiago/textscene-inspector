/**
 * PathFollow2D linter tests — parent must be Path2D + progress range checks.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('PathFollow2D Linter', () => {
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a PathFollow2D that is a direct child of a Path2D', () => {
    const content = `[gd_scene format=3]

[sub_resource type="Curve2D" id="curve_1"]

[node name="Path2D" type="Path2D"]
curve = SubResource("curve_1")

[node name="PathFollow2D" type="PathFollow2D" parent="."]
progress_ratio = 0.5
`;
    const diagnostics = linter.lint(content);
    expect(diagnostics.filter((d) => d.nodeType === 'PathFollow2D')).toHaveLength(0);
  });

  it('errors when the parent is not a Path2D', () => {
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="PathFollow2D" type="PathFollow2D" parent="."]
`;
    const diagnostics = linter.lint(content);
    const err = diagnostics.find((d) => d.ruleName === 'pathfollow2d-invalid-parent');
    expect(err).toBeDefined();
    expect(err!.severity).toBe('error');
  });

  it('errors when PathFollow2D is at the scene root (no parent)', () => {
    const content = `[gd_scene format=3]

[node name="PathFollow2D" type="PathFollow2D"]
`;
    const diagnostics = linter.lint(content);
    expect(diagnostics.find((d) => d.ruleName === 'pathfollow2d-no-parent')).toBeDefined();
  });

  it('warns when progress_ratio is outside 0-1', () => {
    const content = `[gd_scene format=3]

[node name="Path2D" type="Path2D"]

[node name="PathFollow2D" type="PathFollow2D" parent="."]
progress_ratio = 1.5
`;
    const diagnostics = linter.lint(content);
    const warn = diagnostics.find((d) => d.ruleName === 'pathfollow2d-progress-ratio-out-of-range');
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe('warning');
  });

  it('accepts the gamepiece.tscn shape: PathFollow2D with loop=false under a curveless Path2D', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://gamepiece.gd" id="1"]

[node name="Gamepiece" type="Path2D"]
script = ExtResource("1")

[node name="PathFollow2D" type="PathFollow2D" parent="."]
loop = false
`;
    const diagnostics = linter.lint(content);
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    expect(diagnostics.filter((d) => d.nodeType === 'PathFollow2D')).toHaveLength(0);
  });
});
