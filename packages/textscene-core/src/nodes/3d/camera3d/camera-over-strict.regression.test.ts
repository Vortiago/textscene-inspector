/**
 * Regression contract for #149 — Camera3D linter is over-strict.
 *
 * False positives on valid Godot output:
 *  - a PERSPECTIVE camera with no explicit `fov` but `attributes =
 *    SubResource(CameraAttributesPhysical)` drives fov physically — valid.
 *  - an ORTHOGONAL camera with no `size` is valid (Godot defaults size to 1.0).
 *  - a PERSPECTIVE camera with no `fov` at all is valid: Godot's serializer
 *    omits default-valued properties, so the editor's own output for a
 *    default-fov camera carries no `fov` line. The missing-fov error rule is
 *    gone entirely; the parser supplies the 75-degree default.
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

  it('does NOT error on a perspective camera with no fov (Godot omits the 75 default)', () => {
    const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
`;
    expect(linter.lint(content).filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('does NOT error on a perspective camera with an explicit fov', () => {
    const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
fov = 75.0
`;
    expect(linter.lint(content).filter((d) => d.severity === 'error')).toEqual([]);
  });
});
