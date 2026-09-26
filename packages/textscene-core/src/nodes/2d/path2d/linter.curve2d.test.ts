/**
 * `curve2d-loadable`: does Godot load the Curve2D this Path2D points at? A Curve2D whose
 * `_data` `Curve2D::_set_data` refuses loads with zero points, so the path draws nothing
 * and a PathFollow2D on it never moves.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from '../../../linter/Linter';
import '../../../linter/index.js';

function lint(curveData: string) {
  const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="Curve2D" id="Curve2D_test"]
_data = {
${curveData}
}
point_count = 2

[node name="Root" type="Node2D"]

[node name="Path2D" type="Path2D" parent="."]
curve = SubResource("Curve2D_test")

[node name="Follower" type="PathFollow2D" parent="Path2D"]
`;
  return new Linter().lint(content);
}

const POINTS = '"points": PackedVector2Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 480, 0)';

function curveErrors(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === 'curve2d-loadable');
}

describe('curve2d-loadable', () => {
  it('accepts a curve with a whole number of control points', () => {
    expect(curveErrors(lint(POINTS))).toEqual([]);
  });

  // `ERR_FAIL_COND(!p_data.has("points"))` (curve.cpp:1239).
  it('rejects a curve missing "points" as an error', () => {
    const errors = curveErrors(lint(''));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.severity).toBe('error');
    expect(errors[0]!.message).toContain('"points"');
    expect(errors[0]!.message).toContain('zero points');
  });

  // `ERR_FAIL_COND(pc % 3 != 0)` (curve.cpp:1243): six floats per control point.
  it('rejects a points array that is not a whole number of control points', () => {
    const errors = curveErrors(lint('"points": PackedVector2Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0)'));
    expect(errors).toHaveLength(1);
    expect(errors[0]!.severity).toBe('error');
    expect(errors[0]!.message).toContain('holds 10 floats');
    expect(errors[0]!.message).toContain('6 floats each');
  });

  // The flat constructor builds `args.size() / 2` vectors (variant_parser.cpp:1555), so
  // the odd float is gone before `_set_data` counts them, and one whole point loads.
  it('accepts a trailing partial vector, which the variant parser drops', () => {
    expect(curveErrors(lint('"points": PackedVector2Array(0, 0, 0, 0, 10, 20, 5)'))).toEqual([]);
  });

  // `curve.cpp:1241` `PackedVector2Array rp = p_data["points"]` is a Variant
  // conversion, and ARRAY is a strict source for PACKED_VECTOR2_ARRAY
  // (variant.cpp:449-478), so both array spellings load.
  it('accepts the bare-array and typed-array spellings of points', () => {
    const bare =
      '"points": [Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(10, 0)]';
    expect(curveErrors(lint(bare))).toEqual([]);
    const typed =
      '"points": Array[Vector2]([Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(10, 0)])';
    expect(curveErrors(lint(typed))).toEqual([]);
  });

  it('counts the control points of a bare-array spelling', () => {
    const short = '"points": [Vector2(0, 0), Vector2(0, 0), Vector2(0, 0), Vector2(1, 0)]';
    expect(curveErrors(lint(short)).map((d) => d.message)).toEqual([
      expect.stringContaining('holds 8 floats'),
    ]);
  });

  describe('an id the file declares twice', () => {
    /** A Path2D scene whose `curve` names `Shared`, with `blocks` declaring it. */
    function lintSharedId(...blocks: string[]) {
      return new Linter().lint(`[gd_scene format=3]

${blocks.join('\n\n')}

[node name="Path2D" type="Path2D"]
curve = SubResource("Shared")
`);
    }

    const POINTLESS_CURVE2D = '[sub_resource type="Curve2D" id="Shared"]\n_data = {\n}';
    const SOUND_CURVE2D = `[sub_resource type="Curve2D" id="Shared"]\n_data = {\n${POINTS}\n}`;

    it('checks the first Curve2D under the id when another type holds it first', () => {
      const errors = curveErrors(lintSharedId('[sub_resource type="Curve" id="Shared"]', POINTLESS_CURVE2D));
      expect(errors).toHaveLength(1);
    });

    it('checks only the first of two Curve2D declarations under the id', () => {
      expect(curveErrors(lintSharedId(SOUND_CURVE2D, POINTLESS_CURVE2D))).toEqual([]);
      expect(curveErrors(lintSharedId(POINTLESS_CURVE2D, SOUND_CURVE2D))).toHaveLength(1);
    });
  });

  it('stays quiet when the curve reference points at no resource in this scene', () => {
    // dangling-resource-reference already reports a missing resource.
    const content = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Path2D" type="Path2D" parent="."]
curve = SubResource("Nope")
`;
    expect(curveErrors(new Linter().lint(content))).toEqual([]);
  });

  it('stays quiet when the curve is a Curve3D, which another rule answers', () => {
    const content = `[gd_scene format=3]

[sub_resource type="Curve3D" id="Wrong"]
_data = {
}

[node name="Path2D" type="Path2D"]
curve = SubResource("Wrong")
`;
    expect(curveErrors(new Linter().lint(content))).toEqual([]);
  });
});
