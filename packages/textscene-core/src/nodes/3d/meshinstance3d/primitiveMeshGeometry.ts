/**
 * Builds a Godot PrimitiveMesh sub-resource's one surface by choosing the mesh slice a `type=`
 * names, then applies what `PrimitiveMesh::_update` applies to every type. Each slice owns its
 * decode and its build (ADR-0031). Plain data, not JSX, so CSGMesh3D's boolean evaluator shares
 * the one definition.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { parseOptionalAabb } from '../../../parser/valueParsers';
import { aabbOfPoints, EMPTY_AABB, isEmptyAabb, type Aabb } from '../../../godot/math/aabb';
import { bottomUpV } from '../../../godot/math/uv';
import { DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE } from '../../../godot/scene/primitiveMesh';
import { godotSurfacesGeometry, type GodotSurface } from '../../../resources/meshes/godotSurface';
import { drawOrderIndices } from '../../../resources/meshes/arraymesh/decode';
import { decodePrimitiveMesh } from '../../../resources/meshes/primitivemesh/decode';
import { flipFaces } from '../../../resources/meshes/primitivemesh/flipFaces';
import { decodeBoxMesh } from '../../../resources/meshes/boxmesh/decode';
import { buildBoxMeshGeometry } from '../../../resources/meshes/boxmesh/build';
import { decodeSphereMesh } from '../../../resources/meshes/spheremesh/decode';
import { buildSphereMeshSurface } from '../../../resources/meshes/spheremesh/build';
import { decodePlaneMesh } from '../../../resources/meshes/planemesh/decode';
import { buildPlaneMeshGeometry } from '../../../resources/meshes/planemesh/build';
import { decodeQuadMesh } from '../../../resources/meshes/quadmesh/decode';
import { decodeCylinderMesh } from '../../../resources/meshes/cylindermesh/decode';
import { buildCylinderMeshGeometry } from '../../../resources/meshes/cylindermesh/build';
import { decodeCapsuleMesh } from '../../../resources/meshes/capsulemesh/decode';
import { buildCapsuleMeshSurface } from '../../../resources/meshes/capsulemesh/build';
import { decodeTorusMesh } from '../../../resources/meshes/torusmesh/decode';
import { buildTorusMeshGeometry } from '../../../resources/meshes/torusmesh/build';
import { decodePrismMesh } from '../../../resources/meshes/prismmesh/decode';
import { buildPrismMeshGeometry } from '../../../resources/meshes/prismmesh/build';

/**
 * A slice's surface in Godot's arrays, or null for a mesh Godot builds no surface for.
 * `uv2Padding` is in world units, or null for a mesh with no UV2.
 */
type SurfaceBuilder = (data: Record<string, string>, uv2Padding: number | null) => GodotSurface | null;

/** A slice still built by a three generator: its geometry turned back into Godot's arrays. */
const fromThree =
  (build: (data: Record<string, string>) => THREE.BufferGeometry | null): SurfaceBuilder =>
  (data) => {
    const geometry = build(data);
    if (!geometry) return null;
    const surface = threeGeometrySurface(geometry);
    geometry.dispose();
    return surface;
  };

/**
 * Godot `type=` → the slice that decodes and builds it. QuadMesh has no `build.ts` of its own: it
 * is a PlaneMesh subclass differing only in defaults, so it decodes with its own defaults and
 * builds through PlaneMesh's geometry.
 */
const BUILDERS: Record<string, SurfaceBuilder> = {
  BoxMesh: fromThree((data) => buildBoxMeshGeometry(decodeBoxMesh(data))),
  SphereMesh: (data, uv2Padding) => buildSphereMeshSurface(decodeSphereMesh(data), uv2Padding),
  PlaneMesh: fromThree((data) => buildPlaneMeshGeometry(decodePlaneMesh(data))),
  QuadMesh: fromThree((data) => buildPlaneMeshGeometry(decodeQuadMesh(data))),
  CylinderMesh: fromThree((data) => buildCylinderMeshGeometry(decodeCylinderMesh(data))),
  CapsuleMesh: (data, uv2Padding) => buildCapsuleMeshSurface(decodeCapsuleMesh(data), uv2Padding),
  TorusMesh: fromThree((data) => buildTorusMeshGeometry(decodeTorusMesh(data))),
  PrismMesh: fromThree((data) => buildPrismMeshGeometry(decodePrismMesh(data))),
};

/**
 * The surface `_update` hands the rendering server (`primitive_meshes.cpp:45-123`), in Godot's
 * arrays. `texelSize` is the project's PrimitiveMesh texel size, which turns `uv2_padding` into
 * world units (`:403-407`). Null for an unknown, external (GLB) or unresolvable type, or a mesh
 * Godot would refuse to build.
 */
export function primitiveMeshSurface(resource: TscnInternalResource, texelSize: number): GodotSurface | null {
  // hasOwn: the key is a `[sub_resource type=…]` the file chooses, and bare
  // indexing hands back `Object` for `constructor` or throws for `valueOf`.
  const build = Object.hasOwn(BUILDERS, resource.type) ? BUILDERS[resource.type] : undefined;
  if (!build) return null;
  const base = decodePrimitiveMesh(resource.data);
  const surface = build(resource.data, base.addUv2 ? base.uv2Padding * texelSize : null);
  if (!surface) return null;
  return base.flipFaces ? flipFaces(surface) : surface;
}

/** `primitiveMeshSurface` as one three geometry. */
export function buildPrimitiveMeshGeometry(
  resource: TscnInternalResource,
  texelSize: number
): THREE.BufferGeometry | null {
  const surface = primitiveMeshSurface(resource, texelSize);
  return surface ? godotSurfacesGeometry([surface]) : null;
}

/**
 * The box the rendering server holds for a PrimitiveMesh: its `custom_aabb`, else the box of the
 * vertices it builds (`mesh_storage.cpp:705-712`). A mesh Godot builds no surface for is `AABB()`.
 * Null for a type with no slice here.
 */
export function primitiveMeshAabb(resource: TscnInternalResource): Aabb | null {
  if (!Object.hasOwn(BUILDERS, resource.type)) return null;
  const custom = parseOptionalAabb(resource.data['custom_aabb'], 'custom_aabb');
  if (custom && !isEmptyAabb(custom)) return custom;
  // The texel size only scales UV2, which moves no vertex.
  const surface = primitiveMeshSurface(resource, DEFAULT_PRIMITIVE_MESH_TEXEL_SIZE);
  return surface ? aabbOfPoints(surface.positions) : EMPTY_AABB;
}

/** three fronts triangles counter-clockwise with V up, where Godot fronts them clockwise with V down. */
function threeGeometrySurface(geometry: THREE.BufferGeometry): GodotSurface {
  const positions = Float32Array.from(geometry.getAttribute('position').array);
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const uvs = uv ? Float32Array.from(uv.array) : undefined;
  if (uvs) for (let i = 1; i < uvs.length; i += 2) uvs[i] = bottomUpV(uvs[i]!);
  const index = geometry.getIndex();
  const indices = index ? Uint32Array.from(index.array) : drawOrderIndices(positions.length / 3);
  for (let i = 0; i + 2 < indices.length; i += 3)
    [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!];
  return { positions, normals: normal ? Float32Array.from(normal.array) : undefined, uvs, indices };
}
