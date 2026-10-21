/**
 * A Godot PrimitiveMesh sub-resource as one three geometry, and the box the rendering server
 * holds for it. Plain data, not JSX.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../parser/types';
import { parseNonEmptyAabb } from '../../parser/valueParsers';
import { aabbOfPoints, EMPTY_AABB, type Aabb } from '../../godot/math/aabb';
import { DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE } from '../../godot/scene/primitiveMesh';
import { godotSurfacesGeometry } from '../../resources/meshes/godotSurface';
import { isPrimitiveMeshType, primitiveMeshSurface } from '../../resources/meshes/primitivemesh/surface';
import { resourceContentKey } from '../../resources/resourceContentKey';

/**
 * Written only by `primitiveMeshGeometry`. An entry leaves when its geometry is disposed, which
 * `useDisposeOnRelease` does once its last holder lets go. One a discarded render built waits for
 * the next holder of its content.
 */
const sharedGeometries = new Map<string, THREE.BufferGeometry>();

/**
 * `primitiveMeshSurface` as one three geometry, shared by every holder of equal content: Godot
 * draws one resource as one mesh, whichever MeshLibrary item or node holds it. Null for a mesh
 * Godot builds no surface for.
 */
export function primitiveMeshGeometry(
  resource: TscnInternalResource,
  texelSize: number
): THREE.BufferGeometry | null {
  const key = `${texelSize}|${resourceContentKey(resource)}`;
  const shared = sharedGeometries.get(key);
  if (shared) return shared;
  const surface = primitiveMeshSurface(resource, texelSize);
  if (!surface) return null;
  const geometry = godotSurfacesGeometry([surface]);
  sharedGeometries.set(key, geometry);
  geometry.addEventListener('dispose', () => sharedGeometries.delete(key));
  return geometry;
}

/**
 * The box the rendering server holds for a PrimitiveMesh: its `custom_aabb`, else the box of the
 * vertices it builds (`mesh_storage.cpp:705-712`). A mesh Godot builds no surface for is `AABB()`.
 * Null for a type with no slice here.
 */
export function primitiveMeshAabb(resource: TscnInternalResource): Aabb | null {
  if (!isPrimitiveMeshType(resource.type)) return null;
  const custom = parseNonEmptyAabb(resource.data['custom_aabb'], 'custom_aabb');
  if (custom) return custom;
  // The texel size only scales UV2, which moves no vertex.
  const surface = primitiveMeshSurface(resource, DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE);
  return surface ? aabbOfPoints(surface.positions) : EMPTY_AABB;
}
