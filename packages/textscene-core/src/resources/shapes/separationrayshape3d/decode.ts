/**
 * SeparationRayShape3D decode: property bag in, ray length and slide flag out.
 *
 * Neither setter validates (`separation_ray_shape_3d.cpp:61`, `:71`), so a negative or zero
 * length is kept as authored. The constructor defaults are `length = 1.0` and
 * `slide_on_slope = false` (`separation_ray_shape_3d.h:39-40`).
 */

import { boolOr, floatOr } from '../../../parser/valueParsers';
import type { SeparationRayShape3DProperties } from './types';

export function decodeSeparationRayShape3D(
  properties: Record<string, string>
): SeparationRayShape3DProperties {
  return {
    length: floatOr(properties.length, 1, 'SeparationRayShape3D length'),
    slideOnSlope: boolOr(properties.slide_on_slope, false, 'SeparationRayShape3D slide_on_slope'),
  };
}
