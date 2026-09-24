/**
 * A two-surface ArrayMesh inlined as a `[sub_resource]`, so a test needs no
 * `ResourceLoader`. A PrimitiveMesh has one surface, and `_set`
 * (`scene/3d/mesh_instance_3d.cpp:65-73`) refuses an override past the array
 * `_mesh_changed` (`:407`) sizes, so only this mesh proves a per-surface case.
 */

import type { TscnInternalResource } from '../../../../parser/types';

/** A quad's worth of surface bytes: four vertices, two triangles. */
const QUAD_BODY = `"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")`;

/**
 * A `[sub_resource type="ArrayMesh"]` with two identical quads, each owning the
 * material at its index of `surfaceMaterialIds`, or none for `null`.
 */
export function inlineTwoSurfaceMesh(
  id: string,
  surfaceMaterialIds: readonly (string | null)[] = [null, null]
): TscnInternalResource {
  const surfaces = surfaceMaterialIds
    .map(
      (materialId, i) =>
        `{\n${QUAD_BODY},${materialId ? `\n"material": SubResource("${materialId}"),` : ''}\n"name": "surface_${i}"\n}`
    )
    .join(', ');
  return { id, type: 'ArrayMesh', data: { _surfaces: `[${surfaces}]` } };
}

/**
 * The same mesh as `.tscn` text, for a suite that drives the real parser rather
 * than hand-built `TscnInternalResource` literals.
 */
export function inlineTwoSurfaceMeshTscn(id: string): string {
  const { _surfaces } = inlineTwoSurfaceMesh(id).data as { _surfaces: string };
  return `[sub_resource type="ArrayMesh" id="${id}"]\n_surfaces = ${_surfaces}\n`;
}
