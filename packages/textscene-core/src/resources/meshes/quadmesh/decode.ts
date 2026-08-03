/**
 * QuadMesh decode. In Godot QuadMesh is a PlaneMesh subclass whose only
 * differences are its defaults: it faces +Z (orientation FACE_Z = 2) and
 * defaults to a 1×1 size (PlaneMesh faces +Y and defaults to 2×2). Every other
 * field — subdivide_*, center_offset, flip_faces — is shared, so we delegate to
 * `decodePlaneMesh` with QuadMesh's defaults and render through the same path.
 */

import type { PlaneMeshProperties } from '../planemesh/types';
import { decodePlaneMesh } from '../planemesh/decode';

/** Godot QuadMesh defaults: FACE_Z orientation, 1×1 size. */
const QUAD_MESH_DEFAULTS = { size: { x: 1, y: 1 }, orientation: 2 } as const;

export function decodeQuadMesh(properties: Record<string, string>): PlaneMeshProperties {
  return decodePlaneMesh(properties, QUAD_MESH_DEFAULTS);
}
