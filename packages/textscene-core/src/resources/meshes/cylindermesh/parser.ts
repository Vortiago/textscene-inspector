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

  // Godot defaults: radial_segments=64, rings=4.
  let radial_segments = 64;
  if (properties.radial_segments !== undefined) {
    const parsed = parseInt(properties.radial_segments, 10);
    if (!isNaN(parsed)) {
      radial_segments = parsed;
    }
  }

  let rings = 4;
  if (properties.rings !== undefined) {
    const parsed = parseInt(properties.rings, 10);
    if (!isNaN(parsed)) {
      rings = parsed;
    }
  }

  // Godot cap_top/cap_bottom default true; only an explicit "false" disables.
  const capTop = properties.cap_top !== 'false';
  const capBottom = properties.cap_bottom !== 'false';

  return { top_radius, bottom_radius, height, radial_segments, rings, capTop, capBottom };
}
