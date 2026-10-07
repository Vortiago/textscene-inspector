/**
 * A two-surface ArrayMesh inlined as a `[sub_resource]`, so a test needs no
 * `ResourceLoader`. A PrimitiveMesh has one surface, and `_set`
 * (`scene/3d/mesh_instance_3d.cpp:65-73`) refuses an override past the array
 * `_mesh_changed` (`:407`) sizes, so only this mesh proves a per-surface case.
 */

import type { TscnInternalResource } from '../../../../parser/types';
import { wallQuadSurfaces } from '../../../../resources/testing/arrayMeshSurfaces';

/**
 * A `[sub_resource type="ArrayMesh"]` with two wall quads, each owning the
 * material at its index of `surfaceMaterialIds`, or none for `null`.
 */
export function inlineTwoSurfaceMesh(
  id: string,
  surfaceMaterialIds: readonly (string | null)[] = [null, null]
): TscnInternalResource {
  return { id, type: 'ArrayMesh', data: { _surfaces: twoSurfaces(surfaceMaterialIds) } };
}

/**
 * The same mesh as `.tscn` text, for a suite that drives the real parser rather
 * than hand-built `TscnInternalResource` literals.
 */
export function inlineTwoSurfaceMeshTscn(id: string): string {
  return `[sub_resource type="ArrayMesh" id="${id}"]\n_surfaces = ${twoSurfaces([null, null])}\n`;
}

function twoSurfaces(surfaceMaterialIds: readonly (string | null)[]): string {
  return wallQuadSurfaces(
    ...surfaceMaterialIds.map((materialId, i) => ({
      material: materialId === null ? null : `SubResource("${materialId}")`,
      name: `surface_${i}`,
    }))
  );
}
