/**
 * Regression contract: the Camera3D rule must not diagnose ordinary Godot
 * output.
 *
 * An absent `fov` is never a diagnostic: Godot defaults it to 75
 * (camera_3d.h:68) and omits defaults when serialising, and camera3d/parser.ts
 * defaults it identically. The value bound and the base-chain reach still are.
 *
 * The cases below are the shapes that regressed once, kept as pins.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('Camera3D must not error on ordinary Godot output', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  /** Any diagnostic naming fov, whatever the rule that produced it. */
  const fovDiagnostics = (content: string) =>
    linter.lint(content).filter((d) => d.message.toLowerCase().includes('fov'));

  it('does not diagnose a perspective camera whose fov is driven by attributes', () => {
    const content = `[gd_scene format=3]

[sub_resource type="CameraAttributesPhysical" id="CA_1"]
frustum_focal_length = 25.0

[node name="Camera" type="Camera3D"]
projection = 0
attributes = SubResource("CA_1")
`;
    expect(fovDiagnostics(content)).toEqual([]);
  });

  it('does not diagnose an orthographic camera with no size (Godot defaults to 1.0)', () => {
    const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 1
`;
    expect(linter.lint(content).filter((d) => d.message.includes('size'))).toEqual([]);
  });

  it('does not diagnose a bare perspective camera, which is the common shape', () => {
    // A bare perspective camera: the shape Godot writes whenever fov is 75.
    const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
projection = 0
`;
    expect(fovDiagnostics(content)).toEqual([]);
  });

  it('does not diagnose a camera with no properties at all', () => {
    expect(fovDiagnostics('[gd_scene format=3]\n\n[node name="Camera" type="Camera3D"]\n')).toEqual([]);
  });

  it('still flags a fov outside the range Godot accepts', () => {
    // Removing the presence check must not remove the value check:
    // camera_3d.cpp:682 hints "1,179,0.1,degrees" with no or_greater.
    const content = `[gd_scene format=3]

[node name="Camera" type="Camera3D"]
fov = 250.0
`;
    expect(linter.lint(content).some((d) => d.severity === 'error')).toBe(true);
  });

  it('reaches XRCamera3D too, which inherits the rule', () => {
    // The subclass was invisible to the rule until its applicability moved from
    // an exact type list to the base chain.
    const content = `[gd_scene format=3]

[node name="Camera" type="XRCamera3D"]
fov = 250.0
`;
    expect(linter.lint(content).some((d) => d.severity === 'error')).toBe(true);
  });
});
