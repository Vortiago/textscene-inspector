/**
 * The per-axis UV scale for a triplanar StandardMaterial3D. Godot tiles once per
 * unit × `uv1_scale`, and a PlaneMesh's UVs span its `size`, so
 * `repeat = size × uv1_scale` reproduces the density exactly. A non-planar mesh
 * falls back to the base scale, so its tiling stays approximate.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { decodePlaneMesh } from '../../../resources/meshes/planemesh/decode';

export function triplanarPlaneScale(
  mesh: TscnInternalResource,
  baseScale: { x: number; y: number }
): { x: number; y: number } {
  if (mesh.type !== 'PlaneMesh') return baseScale;
  const { size } = decodePlaneMesh(mesh.data as Record<string, string>);
  return { x: size.x * baseScale.x, y: size.y * baseScale.y };
}
