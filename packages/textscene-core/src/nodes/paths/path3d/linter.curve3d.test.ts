/**
 * `curve3d-loadable`: does Godot load the Curve3D this Path3D points at? A Curve3D without
 * `tilts` parses cleanly and renders here, but `Curve3D::_set_data` bails and Godot loads it
 * with zero points: an empty frame.
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

function bareSix(): string {
  return '"points": [Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, -4)]';
}

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
    // The message says why, because the symptom is silence: the scene looks fine
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
    expect(errors[0]!.message).toContain('9 floats each');
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

  // `curve.cpp:2282` `PackedVector3Array rp = p_data["points"]` is a Variant
  // conversion, and `can_convert_strict` lists ARRAY as a source for every
  // PACKED_* type (variant.cpp:449-478), so the bare and typed array
  // spellings load with the same point count. `:2291` reads "tilts" the same way.
  it('accepts the bare-array and typed-array spellings of points and tilts', () => {
    const bare =
      '"points": [Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, -4)]';
    expect(curveErrors(lint(`${bare},\n"tilts": [0, 0]`))).toEqual([]);
    const typed =
      '"points": Array[Vector3]([Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, -4)])';
    expect(curveErrors(lint(`${typed},\n"tilts": Array[float]([0, 0])`))).toEqual([]);
  });

  it('still counts the control points of a bare-array spelling', () => {
    const short = '"points": [Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(1, 0, 0)]';
    expect(curveErrors(lint(`${short},\n"tilts": [0, 0]`)).map((d) => d.message)).toEqual([
      expect.stringContaining('holds 12 floats'),
    ]);
    expect(curveErrors(lint(`${bareSix()},\n"tilts": [0]`)).map((d) => d.message)).toEqual([
      expect.stringContaining('1 tilt values for 2 control points'),
    ]);
  });

  describe('an id the file declares twice', () => {
    /** A Path3D scene whose `curve` names `Shared`, with `blocks` declaring it. */
    function lintSharedId(...blocks: string[]) {
      return new Linter().lint(`[gd_scene format=3]

${blocks.join('\n\n')}

[node name="Path3D" type="Path3D"]
curve = SubResource("Shared")
`);
    }

    const TILTLESS_CURVE3D = `[sub_resource type="Curve3D" id="Shared"]\n_data = {\n${POINTS}\n}`;
    const SOUND_CURVE3D = `[sub_resource type="Curve3D" id="Shared"]\n_data = {\n${POINTS},\n"tilts": PackedFloat32Array(0, 0)\n}`;

    it('checks the first Curve3D under the id when another type holds it first', () => {
      const errors = curveErrors(lintSharedId('[sub_resource type="Curve" id="Shared"]', TILTLESS_CURVE3D));
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain('tilts');
    });

    it('checks only the first of two Curve3D declarations under the id', () => {
      expect(curveErrors(lintSharedId(SOUND_CURVE3D, TILTLESS_CURVE3D))).toEqual([]);
      expect(curveErrors(lintSharedId(TILTLESS_CURVE3D, SOUND_CURVE3D))).toHaveLength(1);
    });
  });

  it('stays quiet when the curve reference points at no resource in this scene', () => {
    // A missing resource is already reported by dangling-resource-reference. This rule must
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
