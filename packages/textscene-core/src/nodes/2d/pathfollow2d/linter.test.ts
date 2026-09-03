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
progress = 50.0
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

  // path_2d.cpp:384 wraps the whole check in `is_visible_in_tree() &&
  // is_inside_tree()`, so a hidden PathFollow2D is not misplaced as far as
  // Godot is concerned.
  describe('the visibility gate', () => {
    it('stays quiet when the node itself is hidden', () => {
      expectNoDiagnostic(
        scene(node('Node2D', {}, { name: 'Root' }), node('PathFollow2D', { visible: false }, { parent: '.' })),
        { ruleName: 'pathfollow2d-invalid-parent' }
      );
    });

    it('stays quiet at the scene root when hidden', () => {
      expectNoDiagnostic(scene(node('PathFollow2D', { visible: false })), {
        ruleName: 'pathfollow2d-no-parent',
      });
    });

    it('stays quiet when a CanvasItem ancestor is hidden', () => {
      expectNoDiagnostic(
        scene(
          node('Node2D', { visible: false }, { name: 'Root' }),
          node('Node2D', {}, { name: 'Mid', parent: '.' }),
          node('PathFollow2D', {}, { parent: 'Mid' })
        ),
        { ruleName: 'pathfollow2d-invalid-parent' }
      );
    });

    it('still warns when a plain Node breaks the CanvasItem chain below the hidden ancestor', () => {
      expectDiagnostic(
        scene(
          node('Node2D', { visible: false }, { name: 'Root' }),
          node('Node', {}, { name: 'Plain', parent: '.' }),
          node('PathFollow2D', {}, { parent: 'Plain' })
        ),
        { ruleName: 'pathfollow2d-invalid-parent', severity: 'warning' }
      );
    });
  });

  it('errors on progress_ratio even at a perfectly in-range value', () => {
    // The range is beside the point. `set_progress_ratio` opens with
    // ERR_FAIL_NULL_MSG(path) (path_2d.cpp:472) and `path` is bound on
    // enter-tree, which is after the loader applies properties — so 0.5 is
    // dropped exactly as 1.5 is.
    expectDiagnostic(
      scene(node('Path2D'), node('PathFollow2D', { progress_ratio: 0.5 }, { parent: '.' })),
      { ruleName: 'pathfollow2d-progress-ratio-ignored', severity: 'error' }
    );
  });

  it('errors on an out-of-range progress_ratio under the same rule', () => {
    expectDiagnostic(
      scene(node('Path2D'), node('PathFollow2D', { progress_ratio: 1.5 }, { parent: '.' })),
      { ruleName: 'pathfollow2d-progress-ratio-ignored', severity: 'error' }
    );
  });

  it('still errors when progress is authored alongside it, since progress wins', () => {
    expectDiagnostic(
      scene(
        node('Path2D'),
        node('PathFollow2D', { progress: 50.0, progress_ratio: 0.5 }, { parent: '.' })
      ),
      { ruleName: 'pathfollow2d-progress-ratio-ignored', severity: 'error' }
    );
  });

  it('says nothing about progress_ratio when the file never mentions it', () => {
    expectNoDiagnostic(
      scene(node('Path2D'), node('PathFollow2D', { progress: 50.0 }, { parent: '.' })),
      { ruleName: 'pathfollow2d-progress-ratio-ignored' }
    );
  });

  it('stays silent on a non-finite progress, which the setter refuses outright', () => {
    // path_2d.cpp:425 opens `set_progress` with
    // ERR_FAIL_COND(!std::isfinite(p_progress)), so the negative-progress
    // warning has no travel to describe: nothing is stored.
    for (const spelling of ['inf_neg', '-inf', 'nan']) {
      expectNoDiagnostic(
        scene(node('Path2D'), node('PathFollow2D', { progress: spelling }, { parent: '.' })),
        { ruleName: 'pathfollow2d-negative-progress' }
      );
    }
  });

  it('still warns on a negative progress spelled with an exponent', () => {
    expectDiagnostic(
      scene(node('Path2D'), node('PathFollow2D', { progress: '-2e1' }, { parent: '.' })),
      { ruleName: 'pathfollow2d-negative-progress', severity: 'info' }
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
