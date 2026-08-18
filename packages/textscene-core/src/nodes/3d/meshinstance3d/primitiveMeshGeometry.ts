/**
 * Builds a `BufferGeometry` from a Godot PrimitiveMesh sub-resource.
 *
 * A dispatch over the mesh slices: each slice owns its own decode (`decode.ts`,
 * property bag → typed data) and its own THREE construction (`build.ts`,
 * ADR-0031), so the axis fixes and off-by-30-degree corrections live next to the
 * type they belong to. This file only chooses which slice a `type=` names.
 *
 * Callers that need geometry as DATA rather than as JSX share this one
 * definition: CSGMesh3D wraps a mesh resource as a CSG contribution, and the
 * boolean evaluator needs triangles, not a React element.
 *
 * Returns `null` for unknown, external (GLB) or unresolvable mesh types, and for
 * a mesh Godot itself would refuse to build; the caller decides whether that
 * means a placeholder or nothing at all.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { decodeBoxMesh } from '../../../resources/meshes/boxmesh/decode';
import { buildBoxMeshGeometry } from '../../../resources/meshes/boxmesh/build';
import { decodeSphereMesh } from '../../../resources/meshes/spheremesh/decode';
import { buildSphereMeshGeometry } from '../../../resources/meshes/spheremesh/build';
import { decodePlaneMesh } from '../../../resources/meshes/planemesh/decode';
import { buildPlaneMeshGeometry } from '../../../resources/meshes/planemesh/build';
import { decodeQuadMesh } from '../../../resources/meshes/quadmesh/decode';
import { decodeCylinderMesh } from '../../../resources/meshes/cylindermesh/decode';
import { buildCylinderMeshGeometry } from '../../../resources/meshes/cylindermesh/build';
import { decodeCapsuleMesh } from '../../../resources/meshes/capsulemesh/decode';
import { buildCapsuleMeshGeometry } from '../../../resources/meshes/capsulemesh/build';
import { decodeTorusMesh } from '../../../resources/meshes/torusmesh/decode';
import { buildTorusMeshGeometry } from '../../../resources/meshes/torusmesh/build';
import { decodePrismMesh } from '../../../resources/meshes/prismmesh/decode';
import { buildPrismMeshGeometry } from '../../../resources/meshes/prismmesh/build';

/**
 * A stable key over the sub-resource's CONTENT, for memoizing the build.
 *
 * Keying on the resource object instead would rebuild (and never dispose) the geometry on
 * every reparse, because the parser allocates a fresh resource per parse and the source
 * pane reparses on every keystroke.
 */
export function primitiveMeshGeometryKey(resource: TscnInternalResource): string {
  return `${resource.type}|${JSON.stringify(resource.data)}`;
}

/**
 * Godot `type=` → the slice that decodes and builds it. QuadMesh has no
 * `build.ts` of its own: it is a PlaneMesh subclass differing only in defaults,
 * so it decodes with its own defaults and builds through PlaneMesh's geometry.
 */
const BUILDERS: Record<string, (data: Record<string, string>) => THREE.BufferGeometry | null> = {
  BoxMesh: (data) => buildBoxMeshGeometry(decodeBoxMesh(data)),
  SphereMesh: (data) => buildSphereMeshGeometry(decodeSphereMesh(data)),
  PlaneMesh: (data) => buildPlaneMeshGeometry(decodePlaneMesh(data)),
  QuadMesh: (data) => buildPlaneMeshGeometry(decodeQuadMesh(data)),
  CylinderMesh: (data) => buildCylinderMeshGeometry(decodeCylinderMesh(data)),
  CapsuleMesh: (data) => buildCapsuleMeshGeometry(decodeCapsuleMesh(data)),
  TorusMesh: (data) => buildTorusMeshGeometry(decodeTorusMesh(data)),
  PrismMesh: (data) => buildPrismMeshGeometry(decodePrismMesh(data)),
};

export function buildPrimitiveMeshGeometry(
  resource: TscnInternalResource
): THREE.BufferGeometry | null {
  // hasOwn: the key is a `[sub_resource type=…]` the file chooses, and bare
  // indexing hands back `Object` for `constructor` or throws for `valueOf`.
  const build = Object.hasOwn(BUILDERS, resource.type) ? BUILDERS[resource.type] : undefined;
  return build ? build(resource.data as Record<string, string>) : null;
}
