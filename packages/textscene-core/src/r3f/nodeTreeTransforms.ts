/**
 * Transform maths over the parsed node tree, shared by the passes that run before
 * anything mounts: `remoteTransforms.ts` and `csgPolygonPaths.ts`. `basis_x/y/z`
 * are rows, not columns (`utils/transform.ts`), and read the other way they give a
 * transposed matrix that looks plausible until something rotates.
 */

import * as THREE from 'three';
import type { TscnNode } from '../parser/types.js';
import type { Node3DProperties, Transform3D } from '../nodes/base/node3d/types.js';
import { isTopLevelItem } from './canvasPaintOrder.js';
import { nodeEscapesParent } from './nodeEscapesParent.js';

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

/**
 * Global Matrix4: the product of local matrices from the nearest node that carries no Node3D
 * transform, or from the nearest `top_level` node. A Node3D composes only through a Node3D parent
 * (`node_3d.cpp:150`, `:656-660`), and `nodeEscapesParent` names the nodes that break the chain.
 */
export function globalMatrix3D(
  path: string,
  nodeByPath: Map<string, TscnNode>
): THREE.Matrix4 {
  const result = new THREE.Matrix4();
  let acc = '';
  for (const segment of path.split('/')) {
    acc = acc ? `${acc}/${segment}` : segment;
    const node = nodeByPath.get(acc);
    if (!node) continue;
    if (nodeEscapesParent(node, 'Node3D')) {
      result.identity();
      continue;
    }
    if (isTopLevelItem(node)) result.identity();
    result.multiply(localMatrix3D(node));
  }
  return result;
}
