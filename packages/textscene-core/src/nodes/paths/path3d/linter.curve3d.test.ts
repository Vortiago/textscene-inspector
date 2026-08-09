/**
 * `curve3d-loadable`: does Godot actually load the Curve3D this Path3D points at?
 *
 * This rule exists because of a real mistake with a specific signature. While authoring
 * `unit-csg-polygon-path.tscn` the Curve3D was written without a `tilts` array. Our
 * lenient parser read it, the strict parser saw well-formed TSCN, `fixtureLint` passed,
 * `lint:tscn` passed, and the scene rendered a road here. Godot rendered an EMPTY FRAME,
 * because `Curve3D::_set_data` bails without `tilts` and the curve loads with zero points.
 *
 * Only a pixel comparison against a real Godot render caught it. Everything textual we
 * had said the scene was fine, which is exactly the gap this rule closes.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import '../../../linter/index.js';

function lint(curveData: string) {
  const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="Curve3D" id="Curve3D_test"]
_data = {
${curveData}
}
point_count = 2

[node name="Root" type="Node3D"]

[node name="Path3D" type="Path3D" parent="."]
curve = SubResource("Curve3D_test")

[node name="Follower" type="PathFollow3D" parent="Path3D"]
`;
  return new Linter().lint(content);
}

const POINTS = '"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -4)';

function curveErrors(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.severity === 'error' && d.ruleName === 'curve3d-loadable');
}

describe('curve3d-loadable', () => {
  let linter: Linter;
  beforeEach(() => {
    linter = new Linter();
    void linter;
  });

  it('accepts a curve with both points and tilts', () => {
    expect(curveErrors(lint(`${POINTS},\n"tilts": PackedFloat32Array(0, 0)`))).toEqual([]);
  });

  it('rejects a curve missing "tilts", the bug that shipped an empty Godot render', () => {
    const errors = curveErrors(lint(POINTS));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('tilts');
    // The message has to say WHY, because the symptom is silence: the scene looks fine
    // everywhere except in Godot.
    expect(errors[0]!.message).toContain('zero points');
  });

  it('rejects a curve missing "points"', () => {
    const errors = curveErrors(lint('"tilts": PackedFloat32Array(0, 0)'));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('points');
  });

  it('rejects a points array that is not a whole number of control points', () => {
    // Nine floats per point: in.xyz, out.xyz, position.xyz. Ten is a truncated point.
    const errors = curveErrors(
      lint('"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),\n"tilts": PackedFloat32Array(0)')
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('nine floats');
  });

  it('rejects fewer tilts than control points, which Godot reads past the end of', () => {
    const errors = curveErrors(lint(`${POINTS},\n"tilts": PackedFloat32Array(0)`));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain('1 tilt values for 2 control points');
  });

  // `_set_data`'s fill loop runs `for (i < points.size())` and only ever reads
  // `rt[i]` inside it (curve.cpp:2294-2298), so surplus tilts are never touched.
  it('accepts MORE tilts than control points, which Godot simply ignores', () => {
    expect(
      curveErrors(lint(`${POINTS},\n"tilts": PackedFloat32Array(0, 0, 0, 0)`))
    ).toEqual([]);
  });

  it('stays quiet when the curve reference points at no resource in this scene', () => {
    // A missing resource is already reported by valid-path3d-resources; this rule must
    // not pile a second, less useful error on top of it.
    const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Path3D" type="Path3D" parent="."]
curve = SubResource("Nope")

[node name="Follower" type="PathFollow3D" parent="Path3D"]
`;
    expect(curveErrors(new Linter().lint(content))).toEqual([]);
  });
});
