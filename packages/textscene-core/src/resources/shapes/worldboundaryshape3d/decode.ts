/**
 * WorldBoundaryShape3D decode: property bag in, boundary plane out.
 *
 * `world_boundary_shape_3d.cpp:118` stores any plane without validation, so a
 * non-unit normal is kept as authored. A plane that does not parse keeps the
 * `Plane(0, 1, 0, 0)` default (`:136`).
 */

import { packedOr } from '../../../parser/valueParsers';
import { parsePlane } from '../../../parser/vectors';
import type { Plane } from '../../../godot/math/plane';
import type { WorldBoundaryShape3DProperties } from './types';

const DEFAULT_PLANE: Plane = { normal: { x: 0, y: 1, z: 0 }, d: 0 };

export function decodeWorldBoundaryShape3D(
  properties: Record<string, string>
): WorldBoundaryShape3DProperties {
  return { plane: packedOr(properties.plane, parsePlane, DEFAULT_PLANE, 'WorldBoundaryShape3D plane') };
}
