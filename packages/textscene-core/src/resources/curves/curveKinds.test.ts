/**
 * A Curve2D and a Curve3D decode to the same points from each origin: a `[sub_resource]` of the
 * scene, a `.tres` of its own, and a `[sub_resource]` of another `.tres`.
 */

import { describe, expect, it } from 'vitest';
import { loadedAt, originsOf } from '../reading/reading.testkit';
import type { ResourceKind } from '../reading/read';
import { CURVE_2D } from './curve2d';
import { CURVE_3D } from './curve3d';

interface CurveCase {
  readonly kind: ResourceKind<unknown>;
  readonly body: string;
}

const CURVES: readonly CurveCase[] = [
  {
    kind: CURVE_2D,
    body: '_data = {\n"points": PackedVector2Array(0, 0, 0, 0, 0, 0, -10, 0, 10, 0, 100, 50)\n}\npoint_count = 2',
  },
  {
    kind: CURVE_3D,
    body: '_data = {\n"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 1, 4, 0, 2),\n"tilts": PackedFloat32Array(0, 0)\n}\npoint_count = 2',
  },
];

describe.each(CURVES)('the $kind.name kind', (curve) => {
  const [inScene, ...elsewhere] = originsOf(curve.kind.name, curve.body);

  it('decodes control points from a sub-resource of the scene', () => {
    expect(loadedAt(curve.kind, inScene!)).toHaveLength(2);
  });

  it.each(elsewhere)('decodes the same points from $name', (origin) => {
    expect(loadedAt(curve.kind, origin)).toEqual(loadedAt(curve.kind, inScene!));
  });
});
