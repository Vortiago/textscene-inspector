/**
 * SphereMesh parser - parses SphereMesh resources from TSCN.
 */

import type { SphereMeshProperties } from './types';
import { floatOr, intOr } from '../../../parser/valueParsers';

/**
 * Parse SphereMesh properties from TSCN sub_resource data.
 * Godot defaults: radius=0.5, height=1.0
 */
export function parseSphereMesh(properties: Record<string, string>): SphereMeshProperties {
  return {
    radius: floatOr(properties.radius, 0.5, 'SphereMesh radius'),
    height: floatOr(properties.height, 1.0, 'SphereMesh height'),
    radial_segments: intOr(properties.radial_segments, 64, 'SphereMesh radial_segments'),
    rings: intOr(properties.rings, 32, 'SphereMesh rings'),
    isHemisphere: properties.is_hemisphere === 'true',
  };
}
