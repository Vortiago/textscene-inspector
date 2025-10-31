/**
 * CylinderMesh parser - parses CylinderMesh resources from TSCN.
 */

import type { CylinderMeshProperties } from './types';

/**
 * Parse CylinderMesh properties from TSCN sub_resource data.
 * Godot defaults: top_radius=0.5, bottom_radius=0.5, height=2.0
 */
export function parseCylinderMesh(properties: Record<string, string>): CylinderMeshProperties {
  let top_radius = 0.5; // Godot default
  let bottom_radius = 0.5; // Godot default
  let height = 2.0; // Godot default

  if (properties.top_radius !== undefined) {
    const parsed = parseFloat(properties.top_radius);
    if (!isNaN(parsed)) {
      top_radius = parsed;
    }
  }

  if (properties.bottom_radius !== undefined) {
    const parsed = parseFloat(properties.bottom_radius);
    if (!isNaN(parsed)) {
      bottom_radius = parsed;
    }
  }

  if (properties.height !== undefined) {
    const parsed = parseFloat(properties.height);
    if (!isNaN(parsed)) {
      height = parsed;
    }
  }

  const result: CylinderMeshProperties = {
    top_radius,
    bottom_radius,
    height,
  };

  // Optional detail parameters
  if (properties.radial_segments !== undefined) {
    const parsed = parseInt(properties.radial_segments, 10);
    if (!isNaN(parsed)) {
      result.radial_segments = parsed;
    }
  }

  if (properties.rings !== undefined) {
    const parsed = parseInt(properties.rings, 10);
    if (!isNaN(parsed)) {
      result.rings = parsed;
    }
  }

  return result;
}
