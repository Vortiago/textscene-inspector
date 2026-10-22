/**
 * A Godot PrimitiveMesh sub-resource as one three geometry, and the box the rendering server
 * holds for it. Plain data, not JSX.
 */

import type * as THREE from 'three';
import { parseNonEmptyAabb } from '../../parser/valueParsers';
import { aabbOfPoints, EMPTY_AABB, type Aabb } from '../../godot/math/aabb';
import { DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE } from '../../godot/scene/primitiveMesh';
import { godotSurfacesGeometry } from '../../resources/meshes/godotSurface';
import type { ResolvableResource } from '../../resources/scopedResource';
import { meshContentKey } from '../../resources/meshes/meshSource';
import { isPrimitiveMeshType, primitiveMeshSurface } from '../../resources/meshes/primitivemesh/surface';

/**
 * Written only by `primitiveMeshGeometry`. An entry leaves when its geometry is disposed, which
 * `useDisposeOnRelease` does once its last holder lets go. A weak reference lets the collector
 * take one that a discarded render built and no holder ever took.
 */
const sharedGeometries = new Map<string, WeakRef<THREE.BufferGeometry>>();

/**
 * `primitiveMeshSurface` as one three geometry, shared by every holder of equal content: Godot
 * draws one resource as one mesh, whichever MeshLibrary item or node holds it. Null for a mesh
 * Godot builds no surface for.
 */
export function primitiveMeshGeometry(
  mesh: ResolvableResource,
  texelSize: number
): THREE.BufferGeometry | null {
  const key = `${texelSize}|${meshContentKey(mesh)}`;
  const shared = sharedGeometries.get(key)?.deref();
  if (shared) return shared;
  const surface = primitiveMeshSurface(mesh, texelSize);
  if (!surface) return null;
  const geometry = godotSurfacesGeometry([surface]);
  sharedGeometries.set(key, new WeakRef(geometry));
  geometry.addEventListener('dispose', () => forgetSharedGeometry(key, geometry));
  return geometry;
}

/** Drops `geometry`'s entry, and leaves alone a newer geometry that took the key after it. */
function forgetSharedGeometry(key: string, geometry: THREE.BufferGeometry): void {
  const entry = sharedGeometries.get(key)?.deref();
  if (entry === undefined || entry === geometry) sharedGeometries.delete(key);
}

/**
 * The box the rendering server holds for a PrimitiveMesh: its `custom_aabb`, else the box of the
 * vertices it builds (`mesh_storage.cpp:705-712`). A mesh Godot builds no surface for is `AABB()`.
 * Null for a type with no slice here.
 */
export function primitiveMeshAabb(mesh: ResolvableResource): Aabb | null {
  if (!isPrimitiveMeshType(mesh.resource.type)) return null;
  const custom = parseNonEmptyAabb(mesh.resource.data['custom_aabb'], 'custom_aabb');
  if (custom) return custom;
  // The texel size only scales UV2, which moves no vertex.
  const surface = primitiveMeshSurface(mesh, DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE);
  return surface ? aabbOfPoints(surface.positions) : EMPTY_AABB;
}
