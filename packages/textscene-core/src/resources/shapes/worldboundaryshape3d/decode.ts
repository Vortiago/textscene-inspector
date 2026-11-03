/**
 * WorldBoundaryShape3D decode: property bag in, boundary plane out.
 *
 * `world_boundary_shape_3d.cpp:118` stores any plane without validation, so a
 * non-unit normal is kept as authored. A plane that does not parse keeps the
 * `Plane(0, 1, 0, 0)` default (`:136`).
 */

import { warn } from '../../../logger';
import { parsePlane } from '../../../parser/vectors';
import type { Plane } from '../../../godot/math/plane';
import type { WorldBoundaryShape3DProperties } from './types';

const DEFAULT_PLANE: Plane = { normal: { x: 0, y: 1, z: 0 }, d: 0 };

export function decodeWorldBoundaryShape3D(
  properties: Record<string, string>
): WorldBoundaryShape3DProperties {
  if (!properties.plane) return { plane: DEFAULT_PLANE };
  try {
    return { plane: parsePlane(properties.plane) };
  } catch (error) {
    warn(
      `Failed to parse WorldBoundaryShape3D plane: ${error instanceof Error ? error.message : String(error)}`
    );
    return { plane: DEFAULT_PLANE };
  }
}
