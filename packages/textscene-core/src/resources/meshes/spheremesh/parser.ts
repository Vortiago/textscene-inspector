/**
 * SphereMesh parser - parses SphereMesh resources from TSCN.
 */

import type { SphereMeshProperties } from './types';

/**
 * Parse SphereMesh properties from TSCN sub_resource data.
 * Godot defaults: radius=0.5, height=1.0
 */
export function parseSphereMesh(properties: Record<string, string>): SphereMeshProperties {
  let radius = 0.5; // Godot default
  let height = 1.0; // Godot default (for hemisphere support)

  if (properties.radius !== undefined) {
    const parsed = parseFloat(properties.radius);
    if (!isNaN(parsed)) {
      radius = parsed;
    }
  }

  if (properties.height !== undefined) {
    const parsed = parseFloat(properties.height);
    if (!isNaN(parsed)) {
      height = parsed;
    }
  }

  // Godot defaults: radial_segments=64, rings=32.
  let radial_segments = 64;
  if (properties.radial_segments !== undefined) {
    const parsed = parseInt(properties.radial_segments, 10);
    if (!isNaN(parsed)) {
      radial_segments = parsed;
    }
  }

  let rings = 32;
  if (properties.rings !== undefined) {
    const parsed = parseInt(properties.rings, 10);
    if (!isNaN(parsed)) {
      rings = parsed;
    }
  }

  return { radius, height, radial_segments, rings };
}
