/**
 * Path2D linter tests — curve resource validation + the missing-curve
 * divergence from Path3D (warning, not error; suppressed when a script is set).
 *
 * No PathFollow2D-child check: `path_2d.h`/`path_2d.cpp` declare a
 * `get_configuration_warnings()` override only on `PathFollow2D`, never on
 * `Path2D` itself, so a followerless Path2D carries no diagnostic.
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
  it('passes a Path2D with a valid Curve2D SubResource', () => {
    const content = scene(
      '[sub_resource type="Curve2D" id="curve_1"]',
      node('Path2D', { curve: 'SubResource("curve_1")' })
    );
    const diagnostics = lint(content);
    expect(diagnostics.filter((d) => d.nodeType === 'Path2D')).toHaveLength(0);
  });

  it('reports at info, not error, when a Path2D has no curve and no script', () => {
    expectDiagnostic(scene(node('Path2D')), {
      ruleName: 'path2d-missing-curve',
      severity: 'info',
    });
  });

  it('suppresses the missing-curve warning when the node has a script (runtime-assigned)', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://gamepiece.gd" id="1"]

[node name="Path2D" type="Path2D"]
script = ExtResource("1")
`;
    expectNoDiagnostic(content, { ruleName: 'path2d-missing-curve' });
  });

  it('errors when the curve reference points at a non-existent resource', () => {
    expectDiagnostic(scene(node('Path2D', { curve: 'SubResource("does_not_exist")' })), {
      ruleName: 'dangling-resource-reference',
      severity: 'error',
    });
  });

  it('has no diagnostic at all for a curve-having Path2D with no PathFollow2D child', () => {
    expect(
      lint(
        scene(
          '[sub_resource type="Curve2D" id="curve_1"]',
          node('Path2D', { curve: 'SubResource("curve_1")' })
        )
      )
    ).toHaveLength(0);
  });
});

describe('Path2D missing-curve, and the script slot that excuses it', () => {
  const path2d = (props: Record<string, string>) => scene(node('Path2D', props));

  it('still warns when the script slot is explicitly cleared', () => {
    // `'null'` is a truthy string: read raw, a cleared slot claimed a script
    // that could assign the curve at runtime, and the warning vanished.
    expectDiagnostic(path2d({ script: 'null' }), { ruleName: 'path2d-missing-curve' });
  });

  it('warns for a script reference the scene never declares', () => {
    // The exemption is "a script assigns it at runtime". A dangling reference
    // loads no script, so there is nothing to assign it.
    expectDiagnostic(path2d({ script: 'ExtResource("9_gone")' }), {
      ruleName: 'path2d-missing-curve',
    });
  });
});
