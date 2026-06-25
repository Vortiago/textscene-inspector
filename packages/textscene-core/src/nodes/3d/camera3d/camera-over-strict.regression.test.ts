/**
 * Regression contract for #149 — Camera3D linter is over-strict.
 *
 * Two false positives on valid Godot output:
 *  - a PERSPECTIVE camera with no explicit `fov` but `attributes =
 *    SubResource(CameraAttributesPhysical)` drives fov physically — valid, must
 *    not error (the rule must become attributes-aware).
 *  - an ORTHOGONAL camera with no `size` is valid (Godot defaults size to 1.0).
 *
 * Adversarial: the relaxation must NOT delete the genuine check — a PERSPECTIVE
 * camera with neither `fov` NOR `attributes` must STILL error.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('#149 Camera3D over-strict regression', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('does NOT error on a perspective camera whose fov is driven by attributes', () => {
    const content = `[gd_scene format=3]

[sub_resource type="CameraAttributesPhysical" id="CA_1"]
frustum_focal_length = 25.0

[node name="Camera" type="Camera3D"]
projection = 0
attributes = SubResource("CA_1")
`;
    const fovError = linter.lint(content).find((d) => d.ruleName === 'camera3d-missing-fov');
    expect(fovError).toBeUndefined();
  });

  it('does NOT error on an orthographic camera with no size (Godot defaults to 1.0)', () => {
    const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 1
`;
    const sizeError = linter.lint(content).find((d) => d.ruleName === 'camera3d-missing-size');
    expect(sizeError).toBeUndefined();
  });

  it('STILL errors on a perspective camera with neither fov nor attributes', () => {
    const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
`;
    const fovError = linter.lint(content).find((d) => d.ruleName === 'camera3d-missing-fov');
    expect(fovError).toBeDefined();
    expect(fovError!.severity).toBe('error');
  });

  it('does NOT error on a perspective camera with an explicit fov', () => {
    const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
`;
    const fovError = linter.lint(content).find((d) => d.ruleName === 'camera3d-missing-fov');
    expect(fovError).toBeUndefined();
  });
});
