/**
 * QuadMesh decode. Godot's QuadMesh is a PlaneMesh subclass that differs only in
 * its defaults: it faces +Z (FACE_Z = 2) at 1×1, where PlaneMesh faces +Y at 2×2.
 * So it delegates to `decodePlaneMesh` with its own defaults and renders through
 * the same path.
 */

import type { PlaneMeshProperties } from '../planemesh/types';
import { decodePlaneMesh } from '../planemesh/decode';

/** Godot QuadMesh defaults: FACE_Z orientation, 1×1 size. */
const QUAD_MESH_DEFAULTS = { size: { x: 1, y: 1 }, orientation: 2 } as const;

export function decodeQuadMesh(properties: Record<string, string>): PlaneMeshProperties {
  return decodePlaneMesh(properties, QUAD_MESH_DEFAULTS);
}
