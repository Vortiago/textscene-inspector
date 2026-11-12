/** A Curve2D and a Curve3D decode to the same points from every origin. */

import { describeKindFromEveryOrigin } from '../reading/everyOrigin.testkit';
import { CURVE_2D } from './curve2d';
import { CURVE_3D } from './curve3d';

const NO_HANDLE = { x: 0, y: 0 };
const NO_HANDLE_3D = { x: 0, y: 0, z: 0 };

describeKindFromEveryOrigin([
  {
    kind: CURVE_2D,
    className: 'Curve2D',
    body: '_data = {\n"points": PackedVector2Array(0, 0, 0, 0, 0, 0, -10, 0, 10, 0, 100, 50)\n}\npoint_count = 2',
    expected: [
      { in: NO_HANDLE, out: NO_HANDLE, position: NO_HANDLE },
      { in: { x: -10, y: 0 }, out: { x: 10, y: 0 }, position: { x: 100, y: 50 } },
    ],
  },
  {
    kind: CURVE_3D,
    className: 'Curve3D',
    body: '_data = {\n"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 1, 4, 0, 2),\n"tilts": PackedFloat32Array(0, 0)\n}\npoint_count = 2',
    expected: [
      { in: NO_HANDLE_3D, out: NO_HANDLE_3D, position: NO_HANDLE_3D },
      { in: { x: 0, y: 0, z: -1 }, out: { x: 0, y: 0, z: 1 }, position: { x: 4, y: 0, z: 2 } },
    ],
  },
]);
