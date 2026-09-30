/**
 * A MeshInstance3D pose a billboard must replace: a quarter turn about Y, offset along X.
 * Build-excluded through the `src/**\/testing/**` tsconfig rule (test-only).
 */

import type { Transform3D } from '../../../base/node3d/types';

/** Transform3D(0, 0, 1, 0, 1, 0, -1, 0, 0, 3, 0, 0). */
export const YAWED: Transform3D = {
  basis_x: { x: 0, y: 0, z: 1 },
  basis_y: { x: 0, y: 1, z: 0 },
  basis_z: { x: -1, y: 0, z: 0 },
  origin: { x: 3, y: 0, z: 0 },
};
