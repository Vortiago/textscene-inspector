/**
 * BoxMesh parser - parses BoxMesh resources from TSCN.
 */

import type { BoxMeshProperties, Vector3 } from './types';
import { warn } from '../../../logger';

/**
 * Parse Vector3 from Godot format: Vector3(x, y, z)
 */
export function parseVector3(value: string): Vector3 {
  const match = value.match(/^Vector3\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/);

  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(`Invalid Vector3 format: ${value}`);
  }

  return {
    x: parseFloat(match[1]),
    y: parseFloat(match[2]),
    z: parseFloat(match[3]),
  };
}

/**
 * Parse BoxMesh properties from TSCN sub_resource data.
 */
export function parseBoxMesh(properties: Record<string, string>): BoxMeshProperties {
  let size: Vector3 = { x: 1, y: 1, z: 1 }; // Godot default

  if (properties.size) {
    try {
      size = parseVector3(properties.size);
    } catch (error) {
      warn(
        `Failed to parse BoxMesh size: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const subdivide = (key: string): number => {
    const raw = properties[key];
    if (raw === undefined) return 0; // Godot default
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  return {
    size,
    subdivideWidth: subdivide('subdivide_width'),
    subdivideHeight: subdivide('subdivide_height'),
    subdivideDepth: subdivide('subdivide_depth'),
  };
}
