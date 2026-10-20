/**
 * A PrimitiveMesh sub-resource's one surface in Godot's arrays: the slice a `type=` names builds
 * it, then this applies what `PrimitiveMesh::_update` applies to every type. This folder holds that
 * shared PrimitiveMesh base, not a registered Resource slice. MeshInstance3D and CSGMesh3D both
 * read the surface.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { bottomUpV } from '../../../godot/math/uv';
import type { GodotSurface } from '../godotSurface';
import { drawOrderIndices } from '../arraymesh/decode';
import { decodePrimitiveMesh } from './decode';
import { flipFaces } from './flipFaces';
import { decodeBoxMesh } from '../boxmesh/decode';
import { buildBoxMeshGeometry } from '../boxmesh/build';
import { decodeSphereMesh } from '../spheremesh/decode';
import { buildSphereMeshSurface } from '../spheremesh/build';
import { decodePlaneMesh } from '../planemesh/decode';
import { buildPlaneMeshGeometry } from '../planemesh/build';
import { decodeQuadMesh } from '../quadmesh/decode';
import { decodeCylinderMesh } from '../cylindermesh/decode';
import { buildCylinderMeshGeometry } from '../cylindermesh/build';
import { decodeCapsuleMesh } from '../capsulemesh/decode';
import { buildCapsuleMeshSurface } from '../capsulemesh/build';
import { decodeTorusMesh } from '../torusmesh/decode';
import { buildTorusMeshGeometry } from '../torusmesh/build';
import { decodePrismMesh } from '../prismmesh/decode';
import { buildPrismMeshSurface } from '../prismmesh/build';

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
  PrismMesh: (data) => buildPrismMeshSurface(decodePrismMesh(data)),
};

/** Whether a slice here builds `type`. */
export function isPrimitiveMeshType(type: string): boolean {
  // hasOwn: the key is a `[sub_resource type=…]` the file chooses, and bare
  // indexing hands back `Object` for `constructor` or throws for `valueOf`.
  return Object.hasOwn(BUILDERS, type);
}

/**
 * Written only by `primitiveMeshSurface`, per texel size. A resource's entries go when the parsed
 * resource does, so the geometry and the AABB of one mesh share one build.
 */
const builtSurfaces = new WeakMap<TscnInternalResource, Map<number, GodotSurface | null>>();

/**
 * The surface `_update` hands the rendering server (`primitive_meshes.cpp:45-123`), in Godot's
 * arrays. `texelSize` is the project's PrimitiveMesh texel size, which turns `uv2_padding` into
 * world units (`:403-407`). Null for an unknown, external (GLB) or unresolvable type, or a mesh
 * Godot would refuse to build. The surface is shared, so a caller copies before it writes.
 */
export function primitiveMeshSurface(resource: TscnInternalResource, texelSize: number): GodotSurface | null {
  if (!isPrimitiveMeshType(resource.type)) return null;
  let byTexelSize = builtSurfaces.get(resource);
  if (!byTexelSize) builtSurfaces.set(resource, (byTexelSize = new Map()));
  if (!byTexelSize.has(texelSize)) byTexelSize.set(texelSize, buildSurface(resource, texelSize));
  return byTexelSize.get(texelSize)!;
}

function buildSurface(resource: TscnInternalResource, texelSize: number): GodotSurface | null {
  const build = BUILDERS[resource.type]!;
  const base = decodePrimitiveMesh(resource.data);
  const surface = build(resource.data, base.addUv2 ? base.uv2Padding * texelSize : null);
  if (!surface) return null;
  return base.flipFaces ? flipFaces(surface) : surface;
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
