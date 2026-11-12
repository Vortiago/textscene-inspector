/**
 * A Curve2D and a Curve3D decode to the same points from each origin: a `[sub_resource]` of the
 * scene, a `.tres` of its own, and a `[sub_resource]` of another `.tres`.
 */

import { describe, expect, it } from 'vitest';
import { staticSnapshot } from '../reading/staticSnapshot.testkit';
import { nodeReference } from '../reading/scopedReference';
import { sceneTables } from '../reading/reading.testkit';
import type { ResourceKind } from '../reading/read';
import { CURVE_2D } from './curve2d';
import { CURVE_3D } from './curve3d';

interface CurveCase {
  readonly kind: ResourceKind<unknown>;
  readonly type: string;
  readonly body: string;
}

const CURVES: readonly CurveCase[] = [
  {
    kind: CURVE_2D,
    type: 'Curve2D',
    body: '_data = {\n"points": PackedVector2Array(0, 0, 0, 0, 0, 0, -10, 0, 10, 0, 100, 50)\n}\npoint_count = 2',
  },
  {
    kind: CURVE_3D,
    type: 'Curve3D',
    body: '_data = {\n"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 1, 4, 0, 2),\n"tilts": PackedFloat32Array(0, 0)\n}\npoint_count = 2',
  },
];

function readAt(curve: CurveCase, ref: string, scene: string, files: Record<string, string> = {}) {
  const read = staticSnapshot(files).read(nodeReference(ref, sceneTables(scene)), curve.kind);
  if (read.status !== 'loaded') throw new Error(`expected the ${curve.type} to load, got ${read.status}`);
  return read.value;
}

describe.each(CURVES)('the $type kind', (curve) => {
  const inScene = () =>
    readAt(curve, 'SubResource("c")', `[sub_resource type="${curve.type}" id="c"]\n${curve.body}`);

  it('decodes control points from a sub-resource of the scene', () => {
    expect(inScene()).toHaveLength(2);
  });

  it('decodes the same points from a .tres of its own', () => {
    const files = {
      'res://curve.tres': `[gd_resource type="${curve.type}" format=3]\n\n[resource]\n${curve.body}\n`,
    };
    const scene = `[ext_resource type="${curve.type}" path="res://curve.tres" id="1_c"]`;

    expect(readAt(curve, 'ExtResource("1_c")', scene, files)).toEqual(inScene());
  });

  it('decodes the same points from a sub-resource of another .tres', () => {
    const files = {
      'res://holder.tres': `[gd_resource type="Resource" format=3]\n\n[sub_resource type="${curve.type}" id="c"]\n${curve.body}\n\n[resource]\n`,
    };

    expect(readAt(curve, 'res://holder.tres::c', '', files)).toEqual(inScene());
  });
});
