/**
 * CylinderMesh parser - parses CylinderMesh resources from TSCN.
 */

import type { CylinderMeshProperties } from './types';
import { floatOr, intOr } from '../../../parser/valueParsers';

/**
 * Parse CylinderMesh properties from TSCN sub_resource data.
 * Godot defaults: top_radius=0.5, bottom_radius=0.5, height=2.0
 */
export function parseCylinderMesh(properties: Record<string, string>): CylinderMeshProperties {
  return {
    top_radius: floatOr(properties.top_radius, 0.5, 'CylinderMesh top_radius'),
    bottom_radius: floatOr(properties.bottom_radius, 0.5, 'CylinderMesh bottom_radius'),
    height: floatOr(properties.height, 2.0, 'CylinderMesh height'),
    radial_segments: intOr(properties.radial_segments, 64, 'CylinderMesh radial_segments'),
    rings: intOr(properties.rings, 4, 'CylinderMesh rings'),
    capTop: properties.cap_top !== 'false',
    capBottom: properties.cap_bottom !== 'false',
  };
}
