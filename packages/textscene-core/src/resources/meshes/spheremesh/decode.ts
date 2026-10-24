/**
 * SphereMesh decode. Defaults: `primitive_meshes.h:339-343`. `set_radial_segments`
 * (`primitive_meshes.cpp:2141`) floors at 4, and `set_rings` (:2153) ERR_FAILs
 * below 1, keeping the default. Radius and height are independent (:2111, :2124),
 * so a squashed sphere is legal.
 */

import { realOr, settableIntOr } from '../../../parser/valueParsers';
import { flooredCount } from '../meshCounts';
import type { SphereMeshProperties } from './types';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';

export function decodeSphereMesh(properties: Record<string, string>): SphereMeshProperties {
  return {
    radius: realOr(properties.radius, 0.5, 'SphereMesh radius'),
    height: realOr(properties.height, 1.0, 'SphereMesh height'),
    radialSegments: flooredCount(properties.radial_segments, 4, 64, 'SphereMesh radial_segments'),
    rings: settableIntOr(properties.rings, 32, { min: 1 }, 'SphereMesh rings'),
    isHemisphere: boolSlotValue(properties.is_hemisphere) === true,
  };
}
