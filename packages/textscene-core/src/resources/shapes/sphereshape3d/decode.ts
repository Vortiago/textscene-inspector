/**
 * SphereShape3D decode — property bag in, sphere radius out.
 *
 * `sphere_shape_3d.cpp:86` ERR_FAILs a negative radius, so one is refused rather
 * than stored (`:105` constructs with 0.5).
 */

import { nonNegativeOr } from '../../../parser/valueParsers';
import type { SphereShape3DProperties } from './types';

export function decodeSphereShape3D(properties: Record<string, string>): SphereShape3DProperties {
  return { radius: nonNegativeOr(properties.radius, 0.5, 'SphereShape3D radius') };
}
