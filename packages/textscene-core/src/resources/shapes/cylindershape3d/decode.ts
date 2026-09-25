/**
 * CylinderShape3D decode. Unlike CapsuleShape3D the two are independent:
 * `cylinder_shape_3d.cpp:94` and `:105` assign without touching the other. Both
 * ERR_FAIL a negative argument (`:95` / `:106`), refusing the value.
 */

import { nonNegativeOr } from '../../../parser/valueParsers';
import type { CylinderShape3DProperties } from './types';

export function decodeCylinderShape3D(
  properties: Record<string, string>
): CylinderShape3DProperties {
  return {
    radius: nonNegativeOr(properties.radius, 0.5, 'CylinderShape3D radius'),
    height: nonNegativeOr(properties.height, 2, 'CylinderShape3D height'),
  };
}
