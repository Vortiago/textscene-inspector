/** BoxShape3D collision-shape resource parser. */

import { warn } from '../../../logger';
import { parseVector3 } from '../../../parser/vectors';

export interface BoxShape3DProperties {
  /** Box extents. Godot default is Vector3(1, 1, 1). */
  size: { x: number; y: number; z: number };
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
