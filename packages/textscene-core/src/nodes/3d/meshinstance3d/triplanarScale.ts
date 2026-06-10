/**
 * Effective per-axis UV scale for a triplanar StandardMaterial3D.
 *
 * Godot's `uv1_triplanar` / `uv1_world_triplanar` project the texture from
 * world (or object) axes and tile it once per unit × `uv1_scale`, independent
 * of the mesh's own UVs. We don't run a triplanar shader, but for the planar
 * meshes that make up level geometry (floors / walls / ceilings) the tiling
 * DENSITY can be reproduced exactly: a PlaneMesh's UVs span its `size` units
 * (0..1), so a per-unit projection becomes `repeat = size × uv1_scale`. With
 * the default `uv1_scale` (1,1) a 12×3.5 floor then tiles 12×3.5 times instead
 * of stretching a single copy across the whole plane (the "too big" bug).
 *
 * Non-planar meshes have no single planar size, so they fall back to the base
 * scale — their triplanar tiling stays approximate (a full three-axis shader
 * is out of scope for the previewer).
 */

import type { TscnInternalResource } from '../../../parser/types';
import { parsePlaneMesh } from '../../../resources/meshes/planemesh/parser';

export function triplanarPlaneScale(
  mesh: TscnInternalResource,
  baseScale: { x: number; y: number }
): { x: number; y: number } {
  if (mesh.type !== 'PlaneMesh') return baseScale;
  const { size } = parsePlaneMesh(mesh.data as Record<string, string>);
  return { x: size.x * baseScale.x, y: size.y * baseScale.y };
}
