/**
 * Transform maths over the parsed node tree, shared by the passes that run before
 * anything mounts and by the components that place a parsed transform. `basis_x/y/z`
 * are rows, not columns (`utils/transform.ts`), and read the other way they give a
 * transposed matrix that looks plausible until something rotates.
 */

import * as THREE from 'three';
import type { TscnNode } from '../parser/types.js';
import type { Node3DProperties } from '../nodes/base/node3d/types.js';
import { multiplyTransform3D, storedTransform3D, type Transform3D } from '../godot/math/transform3d.js';
import { isTopLevelItem } from './canvasPaintOrder.js';
import { nodeEscapesParent } from './nodeEscapesParent.js';

/** A parsed `Transform3D` as a `Matrix4`. `basis_x/y/z` are the matrix's ROWS. */
export function transform3DToMatrix(t: Transform3D): THREE.Matrix4 {
  return setMatrixFromTransform3D(new THREE.Matrix4(), t);
}

/** `transform3DToMatrix` written into `target`, for a per-frame path that keeps its matrix. */
export function setMatrixFromTransform3D(target: THREE.Matrix4, t: Transform3D): THREE.Matrix4 {
  return target.set(
    t.basis_x.x,
    t.basis_x.y,
    t.basis_x.z,
    t.origin.x,
    t.basis_y.x,
    t.basis_y.y,
    t.basis_y.z,
    t.origin.y,
    t.basis_z.x,
    t.basis_z.y,
    t.basis_z.z,
    t.origin.z,
    0,
    0,
    0,
    1
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

/**
 * `Node3D::get_global_transform` (`node_3d.cpp:655-660`) of `object`: each ancestor's local
 * transform as a `real_t` field holds it, composed from the root in float. Not `matrixWorld`,
 * which three composes in double. Each `matrix` must be current.
 */
export function realGlobalTransform3D(object: THREE.Object3D): Transform3D {
  const local = storedTransform3D(matrixToTransform3D(object.matrix));
  return object.parent ? multiplyTransform3D(realGlobalTransform3D(object.parent), local) : local;
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
export function globalMatrix3D(path: string, nodeByPath: Map<string, TscnNode>): THREE.Matrix4 {
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
