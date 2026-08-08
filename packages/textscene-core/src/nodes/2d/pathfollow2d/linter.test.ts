/**
 * PathFollow2D linter tests — parent must be Path2D + progress range checks.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, lint, expectDiagnostic, expectNoDiagnostic, expectNoErrors } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('PathFollow2D Linter', () => {
  it('passes a PathFollow2D that is a direct child of a Path2D', () => {
    const content = `[gd_scene format=3]

[sub_resource type="Curve2D" id="curve_1"]

[node name="Path2D" type="Path2D"]
curve = SubResource("curve_1")

[node name="PathFollow2D" type="PathFollow2D" parent="."]
progress_ratio = 0.5
`;
    const diagnostics = lint(content);
    expect(diagnostics.filter((d) => d.nodeType === 'PathFollow2D')).toHaveLength(0);
  });

  // path_2d.cpp:385 is a get_configuration_warnings() entry, so it is advisory
  // (ADR-0032) — the same tier the Path3D sibling reports at.
  it('warns when the parent is not a Path2D', () => {
    expectDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('PathFollow2D', {}, { parent: '.' })
      ),
      {
        ruleName: 'pathfollow2d-invalid-parent',
        severity: 'warning',
        contains: ['a child of a Node2D node', 'direct child of a Path2D'],
      }
    );
  });

  it('warns when PathFollow2D is at the scene root (no parent)', () => {
    expectDiagnostic(scene(node('PathFollow2D')), {
      ruleName: 'pathfollow2d-no-parent',
      severity: 'warning',
      contains: ['the scene root', 'direct child of a Path2D'],
    });
  });

  it('stays quiet when the parent is instanced, since its type lives in another file', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://track.tscn" id="1_track"]

[node name="Track" instance=ExtResource("1_track")]

[node name="PathFollow2D" type="PathFollow2D" parent="."]
`;
    const diagnostics = lint(content);
    expect(diagnostics.filter((d) => d.ruleName?.startsWith('pathfollow2d-'))).toHaveLength(0);
  });

  it('warns when progress_ratio is outside 0-1', () => {
    expectDiagnostic(
      scene(
        node('Path2D'),
        node('PathFollow2D', { progress_ratio: 1.5 }, { parent: '.' })
      ),
      { ruleName: 'pathfollow2d-progress-ratio-out-of-range', severity: 'warning' }
    );
  });

  it('warns when both progress and progress_ratio are set', () => {
    expectDiagnostic(
      scene(
        node('Path2D'),
        node('PathFollow2D', { progress: 50.0, progress_ratio: 0.5 }, { parent: '.' })
      ),
      {
        ruleName: 'pathfollow2d-both-progress-properties',
        severity: 'warning',
        // packed_scene.cpp:365-381: file order decides the winner, not
        // 'progress_ratio' unconditionally — and path_2d.cpp:416 means Godot's
        // own saver never writes this dual-key state to begin with.
        contains: ['both', 'file order', 'LAST', 'hand-written'],
      }
    );
  });

  it('does not warn when only progress is set', () => {
    expectNoDiagnostic(
      scene(node('Path2D'), node('PathFollow2D', { progress: 50.0 }, { parent: '.' })),
      { ruleName: 'pathfollow2d-both-progress-properties' }
    );
  });

  it('does not warn when only progress_ratio is set', () => {
    expectNoDiagnostic(
      scene(node('Path2D'), node('PathFollow2D', { progress_ratio: 0.5 }, { parent: '.' })),
      { ruleName: 'pathfollow2d-both-progress-properties' }
    );
  });

  it('accepts the gamepiece.tscn shape: PathFollow2D with loop=false under a curveless Path2D', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://gamepiece.gd" id="1"]

[node name="Gamepiece" type="Path2D"]
script = ExtResource("1")

[node name="PathFollow2D" type="PathFollow2D" parent="."]
loop = false
`;
    expectNoErrors(content);
    const diagnostics = lint(content);
    expect(diagnostics.filter((d) => d.nodeType === 'PathFollow2D')).toHaveLength(0);
  });
});
