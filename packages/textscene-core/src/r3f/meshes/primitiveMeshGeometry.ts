/**
 * A Godot PrimitiveMesh sub-resource as one three geometry, and the box the rendering server
 * holds for it. Plain data, not JSX.
 */

import type * as THREE from 'three';
import { parseNonEmptyAabb } from '../../parser/valueParsers';
import { aabbOfPoints, EMPTY_AABB, type Aabb } from '../../godot/math/aabb';
import { DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE } from '../../godot/scene/primitiveMesh';
import { godotSurfacesGeometry, type GodotSurface } from '../../resources/meshes/godotSurface';
import type { ResolvableResource } from '../../resources/scopedResource';
import { meshContentKey } from '../../resources/meshes/meshSource';
import { isPrimitiveMeshType, primitiveMeshSurface } from '../../resources/meshes/primitivemesh/surface';

/** What `shareGeometry` needs of a cache of geometries, which a `Map` and a `WeakMap` both give. */
interface GeometryCache<K> {
  get(key: K): WeakRef<THREE.BufferGeometry> | undefined;
  set(key: K, geometry: WeakRef<THREE.BufferGeometry>): unknown;
  delete(key: K): unknown;
}

/**
 * The geometry in `cache` under `key`, else one `build` makes, which `cache` then holds until it is
 * disposed, which `useDisposeOnRelease` does once its last holder lets go. A weak reference lets the
 * collector take one that a discarded render built and no holder ever took. Null when `build` is.
 */
function shareGeometry<K>(
  cache: GeometryCache<K>,
  key: K,
  build: () => THREE.BufferGeometry | null
): THREE.BufferGeometry | null {
  const shared = cache.get(key)?.deref();
  if (shared) return shared;
  const geometry = build();
  if (!geometry) return null;
  cache.set(key, new WeakRef(geometry));
  geometry.addEventListener('dispose', () => {
    // A newer geometry may have taken the key since: leave it.
    const entry = cache.get(key)?.deref();
    if (entry === undefined || entry === geometry) cache.delete(key);
  });
  return geometry;
}

/** Written only by `primitiveMeshGeometry`, keyed by content. */
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
  return shareGeometry(sharedGeometries, `${texelSize}|${meshContentKey(mesh)}`, () => {
    const surface = primitiveMeshSurface(mesh, texelSize);
    return surface && godotSurfacesGeometry([surface]);
  });
}

/** Written only by `surfaceGeometry`, keyed by the surface a geometry was made from: an entry goes with its surface. */
const surfaceGeometries = new WeakMap<GodotSurface, WeakRef<THREE.BufferGeometry>>();

/**
 * `surface` as one three geometry, shared by every holder of that surface object. A surface a
 * builder caches per resource (TextMesh) shares one geometry between a node and its box.
 */
export function surfaceGeometry(surface: GodotSurface): THREE.BufferGeometry {
  return shareGeometry(surfaceGeometries, surface, () => godotSurfacesGeometry([surface]))!;
}

/**
 * The box the rendering server holds for a PrimitiveMesh: its `custom_aabb`, else the box of the
 * vertices it builds (`mesh_storage.cpp:705-712`). A mesh Godot builds no surface for is `AABB()`.
 * Null for a type with no slice here.
 */
export function primitiveMeshAabb(mesh: ResolvableResource): Aabb | null {
  if (!isPrimitiveMeshType(mesh.resource.type)) return null;
  // The texel size only scales UV2, which moves no vertex.
  return surfaceMeshAabb(
    mesh.resource.data['custom_aabb'],
    primitiveMeshSurface(mesh, DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE)
  );
}

/** The box of a PrimitiveMesh holding `surface`: its `custom_aabb` text, else the box of the vertices. */
export function surfaceMeshAabb(customAabb: string | undefined, surface: GodotSurface | null): Aabb {
  const custom = parseNonEmptyAabb(customAabb, 'custom_aabb');
  if (custom) return custom;
  return surface ? aabbOfPoints(surface.positions) : EMPTY_AABB;
}
