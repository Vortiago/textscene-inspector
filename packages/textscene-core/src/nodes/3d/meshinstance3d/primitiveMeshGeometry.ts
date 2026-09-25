/**
 * Builds a `BufferGeometry` from a Godot PrimitiveMesh sub-resource by choosing
 * the mesh slice a `type=` names: each slice owns its decode and its THREE
 * build (ADR-0031). Plain data, not JSX, so CSGMesh3D's boolean evaluator shares
 * the one definition.
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
 * A stable key over the sub-resource's content, for memoising the build. The parser
 * allocates a fresh resource on every keystroke, so an identity key would rebuild the
 * geometry each time and never dispose it.
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

/** Null for an unknown, external (GLB) or unresolvable type, or a mesh Godot would refuse to build. */
export function buildPrimitiveMeshGeometry(
  resource: TscnInternalResource
): THREE.BufferGeometry | null {
  // hasOwn: the key is a `[sub_resource type=…]` the file chooses, and bare
  // indexing hands back `Object` for `constructor` or throws for `valueOf`.
  const build = Object.hasOwn(BUILDERS, resource.type) ? BUILDERS[resource.type] : undefined;
  return build ? build(resource.data as Record<string, string>) : null;
}
