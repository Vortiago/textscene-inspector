/** BoxShape3D collision-shape resource parser. */

import { warn } from '../../../logger';

export interface BoxShape3DProperties {
  /** Box extents. Godot default is Vector3(1, 1, 1). */
  size: { x: number; y: number; z: number };
}

function parseVector3(value: string): { x: number; y: number; z: number } {
  const match = value.match(/^Vector3\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)$/);
  if (!match) throw new Error(`Invalid Vector3 format: ${value}`);
  return { x: parseFloat(match[1]!), y: parseFloat(match[2]!), z: parseFloat(match[3]!) };
}

export function parseBoxShape3D(properties: Record<string, string>): BoxShape3DProperties {
  let size = { x: 1, y: 1, z: 1 };
  if (properties.size) {
    try {
      size = parseVector3(properties.size);
    } catch (error) {
      warn(`Failed to parse BoxShape3D size: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { size };
}
