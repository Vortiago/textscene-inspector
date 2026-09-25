/** CSGMesh3D's solid, exposed to the boolean evaluator. */

import type * as THREE from 'three';
import type { CsgGeometryBuilder, CsgGeometryContext } from '../../../../r3f/csg/csgRegistration';
import { findSubResource, parseResourceReference } from '../../../../resources/SubResourceResolver';
import {
  buildPrimitiveMeshGeometry,
  primitiveMeshGeometryKey,
} from '../../meshinstance3d/primitiveMeshGeometry';
import type { CSGMesh3DProperties } from './types';

/**
 * Unlike the other CSG builders this one needs scene resources, which is why the builder
 * signature takes a context at all: the solid lives in a `[sub_resource]`, not in the
 * node's own scalars.
 */
export const csgMesh3DGeometry: CsgGeometryBuilder = (properties, ctx): THREE.BufferGeometry | null => {
  const p = properties as unknown as CSGMesh3DProperties;
  if (!p.mesh) return null;
  const ref = parseResourceReference(p.mesh);
  // An ExtResource mesh is a .tres ArrayMesh or a .glb; neither resolves synchronously.
  if (!ref || ref.type !== 'SubResource') return null;
  const resource = findSubResource(ctx.internalResources, ref.id);
  return resource ? buildPrimitiveMeshGeometry(resource) : null;
};

export function csgMesh3DGeometryKey(
  properties: Record<string, unknown>,
  ctx: CsgGeometryContext
): string {
  const p = properties as unknown as CSGMesh3DProperties;
  if (!p.mesh) return 'mesh:none';
  const ref = parseResourceReference(p.mesh);
  if (!ref || ref.type !== 'SubResource') return `mesh:${p.mesh}`;
  const resource = findSubResource(ctx.internalResources, ref.id);
  // Keyed on the sub-resource's content, since the parser allocates a fresh one per reparse.
  return resource ? `mesh:${primitiveMeshGeometryKey(resource)}` : `mesh:missing:${ref.id}`;
}
