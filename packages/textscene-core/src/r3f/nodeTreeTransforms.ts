/**
 * Transform maths over the PARSED node tree, shared by the scene-wide passes that run
 * between parse and graph assembly.
 *
 * Two passes need the same answers and must not disagree: `remoteTransforms.ts` resolves
 * where a RemoteTransform3D drives its target, and `csgPolygonPaths.ts` resolves where a
 * CSGPolygon3D's Path3D sits when `path_local` is off. Both walk the parsed tree rather
 * than the rendered `Object3D` tree, because they run before anything is mounted.
 *
 * Extracted verbatim rather than re-derived. `basis_x/y/z` are ROWS, not columns (see
 * `utils/transform.ts`), and reading them the other way produces a transposed matrix that
 * looks plausible until something is rotated. That has already been a regression here
 * once; there is no reason to give it a second chance by writing a second copy.
 */

import * as THREE from 'three';
import type { TscnNode } from '../parser/types.js';
import type { Node3DProperties, Transform3D } from '../nodes/base/node3d/types.js';

/** A parsed `Transform3D` as a `Matrix4`. `basis_x/y/z` are the matrix's ROWS. */
export function transform3DToMatrix(t: Transform3D): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    t.basis_x.x, t.basis_x.y, t.basis_x.z, t.origin.x,
    t.basis_y.x, t.basis_y.y, t.basis_y.z, t.origin.y,
    t.basis_z.x, t.basis_z.y, t.basis_z.z, t.origin.z,
    0, 0, 0, 1
  );
}

/** Inverse of `transform3DToMatrix`. */
export function matrixToTransform3D(m: THREE.Matrix4): Transform3D {
  const e = m.elements; // column-major storage: e[col * 4 + row]
  return {
    basis_x: { x: e[0]!, y: e[4]!, z: e[8]! },
    basis_y: { x: e[1]!, y: e[5]!, z: e[9]! },
    basis_z: { x: e[2]!, y: e[6]!, z: e[10]! },
    origin: { x: e[12]!, y: e[13]!, z: e[14]! },
  };
}

/** Local Transform3D of a node as a Matrix4 (identity when absent). */
export function localMatrix3D(node: TscnNode): THREE.Matrix4 {
  const t = (node.properties as Node3DProperties).transform;
  return t ? transform3DToMatrix(t) : new THREE.Matrix4();
}

/** Global Matrix4 = the root-to-node product of local matrices. */
export function globalMatrix3D(
  path: string,
  nodeByPath: Map<string, TscnNode>
): THREE.Matrix4 {
  const result = new THREE.Matrix4();
  let acc = '';
  for (const segment of path.split('/')) {
    acc = acc ? `${acc}/${segment}` : segment;
    const node = nodeByPath.get(acc);
    if (node) result.multiply(localMatrix3D(node));
  }
  return result;
}
